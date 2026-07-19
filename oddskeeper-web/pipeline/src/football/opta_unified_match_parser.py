import traceback
import csv
import json
import logging
import re
import time
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


CSV_PATH = "matches26.csv"
CSV_URL_COLUMN = "url"
MAX_MATCH_COUNT = 5

WAIT_AFTER_LOAD_SECONDS = 1
KEEP_BROWSER_OPEN = True
SAVE_DEBUG_HTML = False


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s"
    )


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def ensure_output_dir() -> Path:
    output_dir = get_project_root() / "data" / "raw" / "opta_unified_matches"
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def create_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.page_load_strategy = "eager"

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(20)
    return driver


def read_match_urls_from_csv(csv_path: str, url_column: str, max_count: int):
    project_root = get_project_root()
    full_path = project_root / csv_path

    if not full_path.exists():
        raise FileNotFoundError(f"CSV bulunamadı: {full_path}")

    urls = []
    with open(full_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        if reader.fieldnames is None:
            raise ValueError("CSV header bulunamadı.")

        if url_column not in reader.fieldnames:
            raise ValueError(
                f"CSV içinde '{url_column}' kolonu yok. Bulunan kolonlar: {reader.fieldnames}"
            )

        for row in reader:
            raw_url = row.get(url_column, "")
            url = clean_text(raw_url)

            if not url:
                continue

            if url not in urls:
                urls.append(url)

            if len(urls) >= max_count:
                break

    if not urls:
        raise ValueError("CSV içinde işlenecek URL bulunamadı.")

    return urls, full_path


def clean_text(value) -> str:
    if value is None:
        return ""
    value = str(value)
    value = value.replace("\u200e", "")
    value = value.replace("\u200f", "")
    value = value.replace("\xa0", " ")
    value = value.replace("‎", "")
    value = value.replace("’", "'")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def element_text(element) -> str:
    try:
        text = clean_text(element.text)
        if text:
            return text
    except Exception:
        pass

    try:
        text = clean_text(element.get_attribute("innerText"))
        if text:
            return text
    except Exception:
        pass

    try:
        text = clean_text(element.get_attribute("textContent"))
        if text:
            return text
    except Exception:
        pass

    return ""


def parse_int(value):
    if value is None:
        return None

    text = clean_text(value)
    if not text:
        return None

    text = text.replace(",", "")
    if re.fullmatch(r"-?\d+", text):
        return int(text)

    return None


def coerce_value(value):
    text = clean_text(value)
    if text == "":
        return ""

    if text == "-":
        return "-"

    if re.fullmatch(r"-?\d+,\d+", text):
        return float(text.replace(",", "."))

    if re.fullmatch(r"-?\d+\.\d+", text):
        return float(text)

    int_value = parse_int(text)
    if int_value is not None:
        return int_value

    return text


def normalize_key(label: str) -> str:
    text = clean_text(label).lower()
    text = text.replace("%", " pct")
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text if text else "unknown"


def extract_id_from_class(class_value: str, prefix: str):
    if not class_value:
        return None

    parts = class_value.split()
    for part in parts:
        if part.startswith(prefix):
            candidate = part.replace(prefix, "").strip()
            if candidate and len(candidate) >= 8 and candidate not in {
                "Both", "Left", "Right", "Name", "Score",
                "Large", "Small", "Home", "Away", "Total"
            }:
                return candidate

    return None


def safe_find_text(parent, by, selector, default=""):
    try:
        el = parent.find_element(by, selector)
        return element_text(el)
    except Exception:
        return default


def wait_for_page(driver):
    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.TAG_NAME, "body"))
    )

    WebDriverWait(driver, 15).until(
        lambda d: d.execute_script("return document.readyState") in ["interactive", "complete"]
    )

    time.sleep(WAIT_AFTER_LOAD_SECONDS)


def wait_for_element(driver, by, selector, timeout=10):
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((by, selector))
        )
        return True
    except Exception:
        return False


def scroll_to_bottom(driver):
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(1.2)


def scroll_to_top(driver):
    driver.execute_script("window.scrollTo(0, 0);")
    time.sleep(0.8)


# =========================
# COOKIE - SESSION BAŞINA 1 KEZ
# =========================
def try_normal_cookie_click(driver) -> bool:
    selectors = [
        (By.ID, "onetrust-accept-btn-handler"),
        (By.ID, "accept"),
        (By.XPATH, '//*[@id="accept"]'),
        (By.XPATH, "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'accept all')]"),
        (By.XPATH, "//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'accept all')]"),
    ]

    for by, selector in selectors:
        try:
            element = WebDriverWait(driver, 1).until(
                EC.element_to_be_clickable((by, selector))
            )
            driver.execute_script("arguments[0].click();", element)
            time.sleep(0.8)
            logging.info(f"Çerez kabul edildi (normal): {selector}")
            return True
        except Exception:
            continue

    return False


def try_shadow_dom_cookie_click(driver) -> bool:
    js = """
    function findInRoot(root) {
        if (!root) return null;

        const directSelectors = [
            '#accept',
            'button#accept',
            'button[data-testid="uc-accept-all-button"]',
            '[data-testid="uc-accept-all-button"]',
            'button[aria-label="Accept All"]',
            'button[mode="primary"]'
        ];

        for (const selector of directSelectors) {
            const el = root.querySelector(selector);
            if (el) return el;
        }

        const all = root.querySelectorAll('*');
        for (const el of all) {
            const text = (el.innerText || el.textContent || '').trim().toLowerCase();
            if (
                (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') &&
                text.includes('accept all')
            ) {
                return el;
            }
        }

        for (const el of all) {
            if (el.shadowRoot) {
                const found = findInRoot(el.shadowRoot);
                if (found) return found;
            }
        }

        return null;
    }

    const host = document.querySelector('#usercentrics-cmp-ui');
    if (!host) {
        return {clicked: false, reason: 'host_not_found'};
    }

    if (!host.shadowRoot) {
        return {clicked: false, reason: 'shadow_root_not_ready'};
    }

    const btn = findInRoot(host.shadowRoot);
    if (!btn) {
        return {clicked: false, reason: 'button_not_found'};
    }

    btn.click();
    return {clicked: true, reason: 'clicked'};
    """

    try:
        result = driver.execute_script(js)
        if isinstance(result, dict) and result.get("clicked"):
            time.sleep(1)
            logging.info("Çerez kabul edildi (shadow DOM).")
            return True
        return False
    except Exception:
        return False


def remove_cookie_banner_if_needed(driver) -> bool:
    js = """
    let removed = false;

    const host = document.querySelector('#usercentrics-cmp-ui');
    if (host) {
        host.remove();
        removed = true;
    }

    const allNodes = Array.from(document.querySelectorAll('body *'));
    for (const node of allNodes) {
        const text = (node.innerText || '').trim().toLowerCase();
        const style = window.getComputedStyle(node);

        if (
            style.position === 'fixed' &&
            (
                text.includes('privacy settings') ||
                text.includes('accept all') ||
                text.includes('deny')
            )
        ) {
            node.remove();
            removed = true;
        }
    }

    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';

    return removed;
    """

    try:
        removed = driver.execute_script(js)
        if removed:
            logging.warning("Cookie banner kaldırıldı. Bu gerçek consent click olmayabilir.")
            return True
        return False
    except Exception:
        return False


def ensure_cookies_once(driver, cookie_state: dict):
    if cookie_state.get("attempted", False):
        return

    cookie_state["attempted"] = True

    for _ in range(2):
        if try_normal_cookie_click(driver):
            cookie_state["handled"] = True
            return
        time.sleep(0.5)

    try:
        scroll_to_bottom(driver)
    except Exception:
        pass

    for _ in range(2):
        if try_normal_cookie_click(driver):
            scroll_to_top(driver)
            cookie_state["handled"] = True
            return

        if try_shadow_dom_cookie_click(driver):
            scroll_to_top(driver)
            cookie_state["handled"] = True
            return

        time.sleep(0.5)

    if remove_cookie_banner_if_needed(driver):
        scroll_to_top(driver)
        cookie_state["handled"] = True
        return

    scroll_to_top(driver)
    cookie_state["handled"] = False
    logging.info("Çerez katmanı çözülemedi ama akış devam ediyor.")


# =========================
# URL NORMALIZE
# =========================
def normalize_match_urls(input_url: str):
    base = input_url.split("?")[0].rstrip("/")
    base = re.sub(r"/(match-summary|opta-points|match-details)$", "", base)

    match_id_match = re.search(r"/match/view/([^/]+)$", base)
    source_match_id = match_id_match.group(1) if match_id_match else "unknown_match"

    season_match = re.search(r"/soccer/([^/]+)/", base)
    source_season_slug = season_match.group(1) if season_match else ""

    return {
        "source_match_id": source_match_id,
        "source_season_slug": source_season_slug,
        "base_url": base,
        "match_summary_url": base + "/match-summary",
        "opta_points_url": base + "/opta-points",
        "match_details_url": base + "/match-details",
    }


def build_page_result(status, page_type, url, data=None, reason="", error_message=""):
    return {
        "status": status,
        "page_type": page_type,
        "url": url,
        "data": data,
        "reason": reason,
        "error_message": error_message,
    }


# =========================
# MATCH SUMMARY
# =========================
def extract_match_info_from_opta0(driver, page_type: str):
    container = driver.find_element(By.ID, "Opta_0")

    meta_block = container.find_element(By.CSS_SELECTOR, ".Opta-Cf[data-match]")
    match_id = meta_block.get_attribute("data-match")
    raw_date_ms = meta_block.get_attribute("data-date")
    winner_id = meta_block.get_attribute("data-match_winner_id")
    winner_side = meta_block.get_attribute("data-match_winner_side")

    team_name_cells = container.find_elements(By.CSS_SELECTOR, "td.Opta-TeamName")
    score_spans = container.find_elements(By.CSS_SELECTOR, "span.Opta-Team-Score")

    home_team_name = element_text(team_name_cells[0]) if len(team_name_cells) >= 1 else ""
    away_team_name = element_text(team_name_cells[1]) if len(team_name_cells) >= 2 else ""

    home_team_source_id = None
    away_team_source_id = None

    if len(team_name_cells) >= 1:
        home_team_source_id = extract_id_from_class(team_name_cells[0].get_attribute("class"), "Opta-Team-")

    if len(team_name_cells) >= 2:
        away_team_source_id = extract_id_from_class(team_name_cells[1].get_attribute("class"), "Opta-Team-")

    home_score = element_text(score_spans[0]) if len(score_spans) >= 1 else ""
    away_score = element_text(score_spans[1]) if len(score_spans) >= 2 else ""

    competition = safe_find_text(container, By.CSS_SELECTOR, "span.Opta-Competition")
    match_date_text = safe_find_text(container, By.CSS_SELECTOR, "span.Opta-Date")

    details = {}
    detail_rows = container.find_elements(By.CSS_SELECTOR, "div.Opta-Matchdata dl")
    for row in detail_rows:
        key = safe_find_text(row, By.TAG_NAME, "dt")
        value = safe_find_text(row, By.TAG_NAME, "dd")
        if key:
            details[key.lower()] = value

    return {
        "source": "opta",
        "page_type": page_type,
        "match_url": driver.current_url,
        "page_title": driver.title,
        "source_match_id": match_id,
        "raw_match_date_ms": raw_date_ms,
        "competition": competition,
        "match_date_text": match_date_text,
        "winner_team_source_id": winner_id,
        "winner_side": winner_side,
        "home_team": {
            "name": home_team_name,
            "source_team_id": home_team_source_id,
            "score": parse_int(home_score),
        },
        "away_team": {
            "name": away_team_name,
            "source_team_id": away_team_source_id,
            "score": parse_int(away_score),
        },
        "venue": details.get("venue", ""),
        "attendance_text": details.get("attendance", ""),
        "attendance": parse_int(details.get("attendance", "")),
        "referee": details.get("referee", ""),
    }


def parse_summary_incident_item(li_element, side: str):
    class_value = li_element.get_attribute("class") or ""
    data_event_id = li_element.get_attribute("data-event-id")

    event_type_code = None
    for part in class_value.split():
        if part.startswith("Opta-Event-Type-"):
            event_type_code = part.replace("Opta-Event-Type-", "")
            break

    hidden_block_text = ""
    try:
        hidden_block = li_element.find_element(By.CSS_SELECTOR, "span.Opta-Hidden")
        hidden_block_text = element_text(hidden_block)
    except Exception:
        hidden_block_text = ""

    title = safe_find_text(li_element, By.CSS_SELECTOR, "span.Opta-Event-Title")
    minute_text = safe_find_text(li_element, By.CSS_SELECTOR, "span.Opta-Event-Min")

    player_texts = []
    player_ps = li_element.find_elements(By.CSS_SELECTOR, "div p")
    for p in player_ps:
        text = element_text(p)
        if text and text not in player_texts:
            player_texts.append(text)

    return {
        "side": side,
        "source_incident_id": data_event_id,
        "event_type_code": event_type_code,
        "event_title": title,
        "minute_text": minute_text,
        "player_texts": player_texts,
        "raw_text": hidden_block_text,
    }


def extract_summary_incidents(driver):
    container = driver.find_element(By.ID, "Opta_1")

    incidents = {
        "home": [],
        "away": [],
        "timeline": [],
    }

    home_items = container.find_elements(By.CSS_SELECTOR, "ul.Opta-Events.Opta-Home li.Opta-MatchEvent")
    away_items = container.find_elements(By.CSS_SELECTOR, "ul.Opta-Events.Opta-Away li.Opta-MatchEvent")
    timeline_items = container.find_elements(By.CSS_SELECTOR, "div.Opta-Timeline div.Opta-MatchEvent")

    for item in home_items:
        incidents["home"].append(parse_summary_incident_item(item, "home"))

    for item in away_items:
        incidents["away"].append(parse_summary_incident_item(item, "away"))

    for item in timeline_items:
        incidents["timeline"].append(parse_summary_incident_item(item, "timeline"))

    return incidents


def extract_summary_header_name(th_element):
    class_value = th_element.get_attribute("class") or ""

    if "Opta-Player" in class_value:
        return "player_name"

    try:
        abbr = th_element.find_element(By.TAG_NAME, "abbr")
        title = abbr.get_attribute("title")
        text = element_text(abbr)
        return clean_text(title or text)
    except Exception:
        pass

    text = element_text(th_element)
    return text if text else "unknown"


def parse_details_total_row(row, columns):
    try:
        player_cell = row.find_element(By.CSS_SELECTOR, "th.Opta-Player")
        label = element_text(player_cell) or "Total"
    except Exception:
        label = "Total"

    tds = row.find_elements(By.CSS_SELECTOR, "td")
    stats = {}

    stat_columns = columns[2:]
    for i, column in enumerate(stat_columns):
        td_index = i
        if td_index >= len(tds):
            stats[column["key"]] = ""
            continue

        stats[column["key"]] = coerce_value(element_text(tds[td_index]))

    return {
        "label": label,
        "stats": stats
    }

def extract_summary_player_stats_sections(driver):
    container = driver.find_element(By.ID, "Opta_2")
    sections = []

    li_sections = container.find_elements(By.CSS_SELECTOR, "ul.Opta-TabbedContent > li")

    for li in li_sections:
        section_title = ""
        title_spans = li.find_elements(By.CSS_SELECTOR, "h3.Opta-Exp span")
        if title_spans:
            section_title = element_text(title_spans[0])

        table_wrappers = li.find_elements(By.CSS_SELECTOR, "div.Opta-Team")
        if not table_wrappers:
            continue

        for wrapper in table_wrappers:
            wrapper_class = wrapper.get_attribute("class") or ""
            team_source_id = extract_id_from_class(wrapper_class, "Opta-Team-")

            try:
                table = wrapper.find_element(By.CSS_SELECTOR, "table.Opta-Striped")
            except Exception:
                continue

            parsed_table = parse_summary_player_table(table)

            sections.append({
                "section_title": section_title,
                "team_source_id": team_source_id,
                "table": parsed_table,
            })

    return sections


def parse_match_summary(driver):
    return {
        "match_info": extract_match_info_from_opta0(driver, "match-summary"),
        "incidents": extract_summary_incidents(driver),
        "player_stats_sections": extract_summary_player_stats_sections(driver),
    }


def collect_match_summary_page(driver, url, cookie_state):
    page_type = "match-summary"

    try:
        driver.get(url)
        wait_for_page(driver)
        ensure_cookies_once(driver, cookie_state)

        has_opta0 = wait_for_element(driver, By.ID, "Opta_0", timeout=8)
        has_opta1 = wait_for_element(driver, By.ID, "Opta_1", timeout=4)
        has_opta2 = wait_for_element(driver, By.ID, "Opta_2", timeout=4)

        if not (has_opta0 and has_opta1 and has_opta2):
            return build_page_result(
                status="missing_data",
                page_type=page_type,
                url=url,
                reason="Match Summary widget bulunamadı. Muhtemelen hükmen / no-data maç."
            )

        data = parse_match_summary(driver)
        return build_page_result(
            status="ok",
            page_type=page_type,
            url=url,
            data=data
        )

    except Exception as e:
        return build_page_result(
            status="error",
            page_type=page_type,
            url=url,
            reason="Match Summary parse sırasında hata oluştu.",
            error_message=str(e)
        )


# =========================
# OPTA POINTS - STATS
# =========================
def get_points_container(driver):
    return driver.find_element(By.ID, "Opta_2")


def get_points_nav_items(container):
    return container.find_elements(By.CSS_SELECTOR, "div.Opta-Nav ul li")


def get_points_tab_sections(container):
    return container.find_elements(By.CSS_SELECTOR, "ul.Opta-TabbedContent > li")


def get_points_tab_titles(driver):
    container = get_points_container(driver)
    titles = []

    nav_items = get_points_nav_items(container)
    for item in nav_items:
        text = element_text(item)
        if text and text not in titles:
            titles.append(text)

    return titles


def click_points_tab_by_title(driver, title: str):
    container = get_points_container(driver)
    nav_items = get_points_nav_items(container)

    target = None
    for item in nav_items:
        if element_text(item) == title:
            target = item.find_element(By.TAG_NAME, "a")
            break

    if target is None:
        raise ValueError(f"Opta Points sekmesi bulunamadı: {title}")

    driver.execute_script("arguments[0].click();", target)

    def tab_ready(d):
        try:
            container_local = get_points_container(d)
            nav_items_local = get_points_nav_items(container_local)
            sections_local = get_points_tab_sections(container_local)

            active_title = ""
            for item in nav_items_local:
                cls = item.get_attribute("class") or ""
                if "Opta-On" in cls:
                    active_title = element_text(item)
                    break

            active_section_exists = False
            for sec in sections_local:
                cls = sec.get_attribute("class") or ""
                if "Opta-On" in cls:
                    sec.find_element(By.CSS_SELECTOR, "table.Opta-Striped")
                    active_section_exists = True
                    break

            return active_title == title and active_section_exists
        except Exception:
            return False

    WebDriverWait(driver, 10).until(tab_ready)
    time.sleep(0.8)


def get_active_points_section(driver):
    container = get_points_container(driver)
    sections = get_points_tab_sections(container)

    for sec in sections:
        cls = sec.get_attribute("class") or ""
        if "Opta-On" in cls:
            return sec

    if sections:
        return sections[0]

    raise ValueError("Aktif Opta Points section bulunamadı.")


def activate_stats_mode_for_active_points_section(driver):
    section = get_active_points_section(driver)

    stats_button = section.find_element(By.CSS_SELECTOR, 'button[value="stats"]')
    points_button = section.find_element(By.CSS_SELECTOR, 'button[value="points"]')

    stats_class = stats_button.get_attribute("class") or ""
    if "Opta-On" in stats_class:
        return "stats"

    driver.execute_script("arguments[0].click();", stats_button)

    def stats_is_active(d):
        try:
            active_section = get_active_points_section(d)
            stats_btn = active_section.find_element(By.CSS_SELECTOR, 'button[value="stats"]')
            points_btn = active_section.find_element(By.CSS_SELECTOR, 'button[value="points"]')

            stats_on = "Opta-On" in (stats_btn.get_attribute("class") or "")
            points_off = "Opta-On" not in (points_btn.get_attribute("class") or "")
            return stats_on and points_off
        except Exception:
            return False

    WebDriverWait(driver, 10).until(stats_is_active)
    time.sleep(1)

    return "stats"


def get_points_header_key_and_label(th, col_index: int):
    class_value = th.get_attribute("class") or ""

    if col_index == 0:
        return "player_name", "Player Name"

    if "Opta-Player-Pos" in class_value:
        return "position_code", "Position"

    try:
        abbr = th.find_element(By.TAG_NAME, "abbr")
        label = clean_text(abbr.get_attribute("title") or abbr.text)
    except Exception:
        label = element_text(th)

    key_match = re.search(r"Opta-Stat-([A-Za-z0-9_]+)", class_value)
    if key_match:
        key = key_match.group(1)
        return key, label if label else key

    fallback_key = f"col_{col_index}"
    return fallback_key, label if label else fallback_key


def parse_points_stats_table(table):
    header_elements = table.find_elements(By.CSS_SELECTOR, "thead tr th")
    headers = []

    for idx, th in enumerate(header_elements):
        key, label = get_points_header_key_and_label(th, idx)
        headers.append({
            "key": key,
            "label": label
        })

    rows = []
    body_rows = table.find_elements(By.CSS_SELECTOR, "tbody tr")

    for row in body_rows:
        row_side = clean_text(row.get_attribute("data-playerside"))

        player_cell = row.find_element(By.CSS_SELECTOR, "th.Opta-Player")
        player_class = player_cell.get_attribute("class") or ""

        player_name = safe_find_text(player_cell, By.CSS_SELECTOR, "span.Opta-playername")
        if not player_name:
            player_name = element_text(player_cell)

        player_source_id = extract_id_from_class(player_class, "Opta-Player-")

        lineup_status = "unknown"
        try:
            start_span = player_cell.find_element(By.CSS_SELECTOR, "span.Opta-startpos")
            start_class = start_span.get_attribute("class") or ""
            if "Opta-starter" in start_class:
                lineup_status = "starter"
            elif "Opta-sub" in start_class:
                lineup_status = "substitute"
        except Exception:
            pass

        position_cell = row.find_element(By.CSS_SELECTOR, "th.Opta-Player-Pos")
        position_code = element_text(position_cell)

        td_elements = row.find_elements(By.CSS_SELECTOR, "td")
        stats = {}

        stat_headers = headers[2:]
        for i, header in enumerate(stat_headers):
            if i >= len(td_elements):
                stats[header["key"]] = ""
                continue

            td = td_elements[i]
            stats[header["key"]] = coerce_value(element_text(td))

        rows.append({
            "player_name": player_name,
            "source_player_id": player_source_id,
            "player_side": row_side,
            "lineup_status": lineup_status,
            "position_code": position_code,
            "stats": stats
        })

    return {
        "headers": headers,
        "row_count": len(rows),
        "rows": rows
    }


def parse_opta_points_stats(driver):
    match_info = extract_match_info_from_opta0(driver, "opta-points-stats")
    tab_titles = get_points_tab_titles(driver)

    if not tab_titles:
        raise ValueError("Opta Points sekmeleri bulunamadı.")

    sections = []

    for title in tab_titles:
        click_points_tab_by_title(driver, title)
        active_mode = activate_stats_mode_for_active_points_section(driver)

        active_section = get_active_points_section(driver)
        wrappers = active_section.find_elements(By.CSS_SELECTOR, "div.Opta-Team")
        if not wrappers:
            continue

        wrapper = wrappers[0]
        wrapper_class = wrapper.get_attribute("class") or ""
        team_source_id = extract_id_from_class(wrapper_class, "Opta-Team-")

        table = wrapper.find_element(By.CSS_SELECTOR, "table.Opta-Striped")
        table_data = parse_points_stats_table(table)

        sections.append({
            "section_title": title,
            "team_source_id": team_source_id,
            "active_mode": active_mode,
            "table": table_data
        })

    return {
        "match_info": match_info,
        "stats_sections": sections
    }


def collect_opta_points_page(driver, url):
    page_type = "opta-points-stats"

    try:
        driver.get(url)
        wait_for_page(driver)

        has_opta2 = wait_for_element(driver, By.ID, "Opta_2", timeout=8)
        if not has_opta2:
            return build_page_result(
                status="missing_data",
                page_type=page_type,
                url=url,
                reason="Opta Points widget bulunamadı. Muhtemelen hükmen / no-data maç."
            )

        data = parse_opta_points_stats(driver)
        return build_page_result(
            status="ok",
            page_type=page_type,
            url=url,
            data=data
        )

    except Exception as e:
        return build_page_result(
            status="error",
            page_type=page_type,
            url=url,
            reason="Opta Points Stats parse sırasında hata oluştu.",
            error_message=str(e)
        )


# =========================
# MATCH DETAILS
# =========================
def get_details_component(driver):
    return driver.find_element(By.CSS_SELECTOR, "playerstats-match")


def get_details_tab_titles(driver):
    links = driver.find_elements(By.CSS_SELECTOR, "playerstats-match ul.Opta-Cf > li > a")
    titles = []

    for link in links:
        text = element_text(link)
        if text and text not in titles:
            titles.append(text)

    return titles


def get_active_details_tab_title(driver):
    try:
        active_link = driver.find_element(By.CSS_SELECTOR, "playerstats-match ul.Opta-Cf > li.Opta-On a")
        return element_text(active_link)
    except Exception:
        return ""


def get_active_details_section(component):
    try:
        return component.find_element(By.CSS_SELECTOR, "ul.Opta-TabbedContent > li.Opta-On")
    except Exception:
        sections = component.find_elements(By.CSS_SELECTOR, "ul.Opta-TabbedContent > li")
        if not sections:
            raise ValueError("Aktif Match Details section bulunamadı.")
        return sections[0]


def click_details_tab_by_title(driver, title: str):
    links = driver.find_elements(By.CSS_SELECTOR, "playerstats-match ul.Opta-Cf > li > a")

    target = None
    for link in links:
        if element_text(link) == title:
            target = link
            break

    if target is None:
        raise ValueError(f"Sekme bulunamadı: {title}")

    driver.execute_script("arguments[0].click();", target)

    def tab_is_ready(d):
        try:
            active_title = get_active_details_tab_title(d)
            component = get_details_component(d)
            active_section = get_active_details_section(component)
            active_section.find_element(By.CSS_SELECTOR, "table.Opta-Striped")
            return active_title == title
        except Exception:
            return False

    WebDriverWait(driver, 10).until(tab_is_ready)
    time.sleep(0.8)


def get_first_player_row(table):
    rows = table.find_elements(By.CSS_SELECTOR, "tbody tr")
    for row in rows:
        try:
            player_cell = row.find_element(By.CSS_SELECTOR, "th.Opta-Player")
            player_name = element_text(player_cell)
            player_class = player_cell.get_attribute("class") or ""
            if "Opta-Total" not in player_class and player_name.lower() != "total":
                return row
        except Exception:
            continue
    return None


def build_details_columns(table):
    header_cells = []
    thead_rows = table.find_elements(By.CSS_SELECTOR, "thead tr")
    if thead_rows:
        header_cells = thead_rows[0].find_elements(By.CSS_SELECTOR, "th, td")

    header_labels = [element_text(cell) for cell in header_cells]

    first_player_row = get_first_player_row(table)
    if first_player_row is None:
        return [
            {"key": "player_name", "label": "Player Name"},
            {"key": "position_code", "label": "Pos."},
        ]

    tds = first_player_row.find_elements(By.CSS_SELECTOR, "td")

    columns = [
        {"key": "player_name", "label": "Player Name"},
        {"key": "position_code", "label": header_labels[1] if len(header_labels) > 1 else "Pos."},
    ]

    for idx, td in enumerate(tds[1:], start=2):
        class_value = td.get_attribute("class") or ""
        label = header_labels[idx] if idx < len(header_labels) else f"col_{idx}"

        match = re.search(r"Opta-Stat-([A-Za-z0-9_]+)", class_value)
        if match:
            key = match.group(1)
        else:
            key = normalize_key(label)

        columns.append({
            "key": key,
            "label": label
        })

    return columns


def detect_lineup_status(player_cell):
    try:
        startpos = player_cell.find_element(By.CSS_SELECTOR, "span.startpos")
        class_value = startpos.get_attribute("class") or ""

        if "starter" in class_value:
            return "starter"
        if "sub" in class_value:
            return "substitute"
    except Exception:
        pass

    return "unknown"


def parse_details_total_row(row, columns):
    player_cell = row.find_element(By.CSS_SELECTOR, "th.Opta-Player")
    label = element_text(player_cell) or "Total"

    tds = row.find_elements(By.CSS_SELECTOR, "td")
    stats = {}

    stat_columns = columns[2:]
    for i, column in enumerate(stat_columns):
        td_index = i
        if td_index >= len(tds):
            stats[column["key"]] = ""
            continue

        stats[column["key"]] = coerce_value(element_text(tds[td_index]))

    return {
        "label": label,
        "stats": stats
    }


def print_page_status(label, page_result):
    line = f"{label}: {page_result['status']}"

    if page_result["reason"]:
        line += f" | reason={page_result['reason']}"

    if page_result["status"] == "error" and page_result.get("error_message"):
        short_error = clean_text(page_result["error_message"]).split("Traceback")[0].strip()
        line += f" | error={short_error[:220]}"

    print(line)

def process_single_match(driver, input_url: str, cookie_state: dict, output_dir: Path):
    urls = normalize_match_urls(input_url)
    match_id = urls["source_match_id"]

    logging.info(f"İşleniyor: {match_id}")

    match_summary_result = collect_match_summary_page(
        driver=driver,
        url=urls["match_summary_url"],
        cookie_state=cookie_state
    )
    save_debug_html(driver, output_dir, match_id, "match_summary")

    opta_points_result = collect_opta_points_page(
        driver=driver,
        url=urls["opta_points_url"]
    )
    save_debug_html(driver, output_dir, match_id, "opta_points")

    fallback_match_info = None
    if match_summary_result["status"] == "ok":
        fallback_match_info = match_summary_result["data"]["match_info"]
    elif opta_points_result["status"] == "ok":
        fallback_match_info = opta_points_result["data"]["match_info"]

    match_details_result = collect_match_details_page(
        driver=driver,
        url=urls["match_details_url"],
        fallback_match_info=fallback_match_info
    )
    save_debug_html(driver, output_dir, match_id, "match_details")

    result = {
        "input_url": input_url,
        "normalized_urls": urls,
        "match_summary": match_summary_result,
        "opta_points_stats": opta_points_result,
        "match_details": match_details_result,
    }

    match_json_path = output_dir / f"{match_id}.json"
    with open(match_json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    logging.info(f"Maç JSON kaydedildi: {match_json_path}")

    return result

def parse_details_table(table):
    columns = build_details_columns(table)
    body_rows = table.find_elements(By.CSS_SELECTOR, "tbody tr")

    players = []
    totals = None

    for row in body_rows:
        row_data, row_type = parse_details_player_row(row, columns)

        if row_type == "player" and row_data is not None:
            players.append(row_data)
        elif row_type == "total":
            totals = parse_details_total_row(row, columns)

    return {
        "columns": columns,
        "row_count": len(players),
        "rows": players,
        "totals": totals
    }


def map_section_team_id(section_title: str, match_info: dict):
    home_team = match_info.get("home_team", {})
    away_team = match_info.get("away_team", {})

    if section_title == "All":
        return None

    if section_title == home_team.get("name"):
        return home_team.get("source_team_id")

    if section_title == away_team.get("name"):
        return away_team.get("source_team_id")

    return None


def parse_match_details(driver):
    match_info = extract_match_info_from_opta0(driver, "match-details")
    tab_titles = get_details_tab_titles(driver)

    if not tab_titles:
        raise ValueError("Match Details sekmeleri bulunamadı.")

    sections = []

    for section_title in tab_titles:
        click_details_tab_by_title(driver, section_title)

        component = get_details_component(driver)
        active_section = get_active_details_section(component)

        table = active_section.find_element(By.CSS_SELECTOR, "table.Opta-Striped")
        table_data = parse_details_table(table)

        sections.append({
            "section_title": section_title,
            "team_source_id": map_section_team_id(section_title, match_info),
            "table": table_data
        })

    return {
        "match_info": match_info,
        "details_sections": sections
    }


def collect_match_details_page(driver, url):
    page_type = "match-details"

    try:
        driver.get(url)
        wait_for_page(driver)

        has_container = wait_for_element(driver, By.ID, "opta-player-stats-container", timeout=8)
        has_component = wait_for_element(driver, By.CSS_SELECTOR, "playerstats-match", timeout=4)
        has_table = wait_for_element(driver, By.CSS_SELECTOR, "playerstats-match table.Opta-Striped", timeout=4)

        if not (has_container and has_component and has_table):
            return build_page_result(
                status="missing_data",
                page_type=page_type,
                url=url,
                reason="Match Details widget bulunamadı. Muhtemelen hükmen / no-data maç."
            )

        data = parse_match_details(driver)
        return build_page_result(
            status="ok",
            page_type=page_type,
            url=url,
            data=data
        )

    except Exception as e:
        return build_page_result(
            status="error",
            page_type=page_type,
            url=url,
            reason="Match Details parse sırasında hata oluştu.",
            error_message=str(e)
        )


# =========================
# SAVE / PROCESS
# =========================
def save_debug_html(driver, output_dir: Path, match_id: str, page_name: str):
    if not SAVE_DEBUG_HTML:
        return

    html_path = output_dir / f"{match_id}_{page_name}.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(driver.page_source)


def process_single_match(driver, input_url: str, cookie_state: dict, output_dir: Path):
    urls = normalize_match_urls(input_url)
    match_id = urls["source_match_id"]

    logging.info(f"İşleniyor: {match_id}")

    match_summary_result = collect_match_summary_page(
        driver=driver,
        url=urls["match_summary_url"],
        cookie_state=cookie_state
    )
    save_debug_html(driver, output_dir, match_id, "match_summary")

    opta_points_result = collect_opta_points_page(
        driver=driver,
        url=urls["opta_points_url"]
    )
    save_debug_html(driver, output_dir, match_id, "opta_points")

    match_details_result = collect_match_details_page(
        driver=driver,
        url=urls["match_details_url"]
    )
    save_debug_html(driver, output_dir, match_id, "match_details")

    result = {
        "input_url": input_url,
        "normalized_urls": urls,
        "match_summary": match_summary_result,
        "opta_points_stats": opta_points_result,
        "match_details": match_details_result,
    }

    match_json_path = output_dir / f"{match_id}.json"
    with open(match_json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    logging.info(f"Maç JSON kaydedildi: {match_json_path}")

    return result


def save_all_results(results, output_dir: Path):
    all_json_path = output_dir / "all_matches.json"
    with open(all_json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    logging.info(f"Tüm maçlar kaydedildi: {all_json_path}")


def print_page_status(label, page_result):
    print(
        f"{label}: {page_result['status']}"
        + (f" | reason={page_result['reason']}" if page_result["reason"] else "")
    )


def print_result_summary(result):
    summary_result = result["match_summary"]
    points_result = result["opta_points_stats"]
    details_result = result["match_details"]

    print("\n========== MAÇ ÖZETİ ==========")
    print("Input URL:", result["input_url"])
    print("Match ID:", result["normalized_urls"]["source_match_id"])
    print("Season slug:", result["normalized_urls"]["source_season_slug"])

    if summary_result["status"] == "ok":
        info = summary_result["data"]["match_info"]
        print("Maç:", info["home_team"]["name"], "-", info["away_team"]["name"])
        print("Skor:", info["home_team"]["score"], "-", info["away_team"]["score"])
        print("Competition:", info["competition"])
        print("Date:", info["match_date_text"])
    else:
        print("Maç bilgisi: alınamadı")

    print_page_status("Match Summary", summary_result)
    print_page_status("Opta Points Stats", points_result)
    print_page_status("Match Details", details_result)

    if summary_result["status"] == "ok":
        print("Summary sections:", len(summary_result["data"]["player_stats_sections"]))
    if points_result["status"] == "ok":
        print("Opta Points Stats sections:", len(points_result["data"]["stats_sections"]))
    if details_result["status"] == "ok":
        print("Match Details sections:", len(details_result["data"]["details_sections"]))


def main():
    setup_logging()
    output_dir = ensure_output_dir()

    urls, csv_full_path = read_match_urls_from_csv(
        csv_path=CSV_PATH,
        url_column=CSV_URL_COLUMN,
        max_count=MAX_MATCH_COUNT
    )

    logging.info(f"CSV bulundu: {csv_full_path}")
    logging.info(f"İşlenecek maç sayısı: {len(urls)}")

    driver = create_driver()

    cookie_state = {
        "attempted": False,
        "handled": False
    }

    all_results = []

    try:
        for idx, input_url in enumerate(urls, start=1):
            logging.info(f"{idx}/{len(urls)} başladı")

            try:
                result = process_single_match(driver, input_url, cookie_state, output_dir)
                all_results.append(result)
                print_result_summary(result)
            except Exception as e:
                logging.exception(f"Bu maç işlenirken beklenmeyen üst seviye hata oluştu: {input_url} | {e}")

        save_all_results(all_results, output_dir)
        logging.info("Tüm akış tamamlandı.")

        if KEEP_BROWSER_OPEN:
            input("\nTarayıcı açık bırakıldı. Kapatmak için Enter'a bas...")

    except TimeoutException:
        logging.error("Genel akışta timeout oluştu.")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()