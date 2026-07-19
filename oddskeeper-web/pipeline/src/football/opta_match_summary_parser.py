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


MATCH_URL = "https://optaplayerstats.statsperform.com/en_GB/soccer/s%C3%BCper-lig-2025-2026/97zghcaoec1isvvdkh9ud50d0/match/view/888oseoozq8b89mcdl2mis2l0/match-summary"
WAIT_AFTER_LOAD_SECONDS = 1
KEEP_BROWSER_OPEN = True
SAVE_HTML_COPY = True


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s"
    )


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def ensure_output_dir() -> Path:
    output_dir = get_project_root() / "data" / "raw" / "opta_match_summary"
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def create_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.page_load_strategy = "eager"

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(20)
    return driver


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
        text = element.text
        text = clean_text(text)
        if text:
            return text
    except Exception:
        pass

    try:
        text = element.get_attribute("innerText")
        text = clean_text(text)
        if text:
            return text
    except Exception:
        pass

    try:
        text = element.get_attribute("textContent")
        text = clean_text(text)
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


def coerce_stat_value(value):
    text = clean_text(value)
    if text == "":
        return ""

    int_value = parse_int(text)
    if int_value is not None:
        return int_value

    if re.fullmatch(r"-?\d+\.\d+", text):
        return float(text)

    return text


def extract_id_from_class(class_value: str, prefix: str):
    if not class_value:
        return None

    parts = class_value.split()
    candidates = []

    for part in parts:
        if part.startswith(prefix):
            candidate = part.replace(prefix, "").strip()
            candidates.append(candidate)

    blacklist = {
        "Left", "Right", "Name", "Score", "Both",
        "Large", "Small", "Home", "Away", "Total"
    }

    filtered = [x for x in candidates if x and x not in blacklist and len(x) >= 8]

    if filtered:
        return filtered[0]

    return None


def scroll_to_bottom(driver):
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(1.5)


def scroll_to_top(driver):
    driver.execute_script("window.scrollTo(0, 0);")
    time.sleep(1)


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
            element = WebDriverWait(driver, 2).until(
                EC.element_to_be_clickable((by, selector))
            )
            driver.execute_script("arguments[0].click();", element)
            time.sleep(1)
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
            time.sleep(1.5)
            logging.info("Çerez kabul edildi (shadow DOM).")
            return True

        logging.info(f"Shadow DOM cookie click başarısız: {result}")
        return False
    except Exception as e:
        logging.info(f"Shadow DOM cookie click hata verdi: {e}")
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
            time.sleep(1)
            logging.warning("Cookie banner kaldırıldı. Bu gerçek consent click olmayabilir.")
            return True
        return False
    except Exception as e:
        logging.info(f"Cookie banner remove hata verdi: {e}")
        return False


def accept_cookies(driver):
    for _ in range(2):
        if try_normal_cookie_click(driver):
            return True
        time.sleep(1)

    try:
        scroll_to_bottom(driver)
    except Exception:
        pass

    for _ in range(3):
        if try_normal_cookie_click(driver):
            scroll_to_top(driver)
            return True

        if try_shadow_dom_cookie_click(driver):
            scroll_to_top(driver)
            return True

        time.sleep(1.5)

    if remove_cookie_banner_if_needed(driver):
        scroll_to_top(driver)
        return True

    scroll_to_top(driver)
    logging.info("Çerez katmanı çözülemedi.")
    return False


def wait_for_page(driver):
    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.TAG_NAME, "body"))
    )

    WebDriverWait(driver, 15).until(
        lambda d: d.execute_script("return document.readyState") in ["interactive", "complete"]
    )

    time.sleep(WAIT_AFTER_LOAD_SECONDS)


def wait_for_match_summary_widgets(driver):
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.ID, "Opta_0"))
    )
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.ID, "Opta_1"))
    )
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.ID, "Opta_2"))
    )
    time.sleep(0.5)


def safe_find_text(parent, by, selector, default=""):
    try:
        el = parent.find_element(by, selector)
        return element_text(el)
    except Exception:
        return default


def extract_match_info(driver):
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
        home_team_source_id = extract_id_from_class(
            team_name_cells[0].get_attribute("class"),
            "Opta-Team-"
        )

    if len(team_name_cells) >= 2:
        away_team_source_id = extract_id_from_class(
            team_name_cells[1].get_attribute("class"),
            "Opta-Team-"
        )

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
        "page_type": "match-summary",
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


def parse_incident_item(li_element, side: str):
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


def extract_incidents(driver):
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
        incidents["home"].append(parse_incident_item(item, side="home"))

    for item in away_items:
        incidents["away"].append(parse_incident_item(item, side="away"))

    for item in timeline_items:
        incidents["timeline"].append(parse_incident_item(item, side="timeline"))

    return incidents


def extract_header_name(th_element):
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


def parse_player_table(table_element):
    headers = []
    header_elements = table_element.find_elements(By.CSS_SELECTOR, "thead th")

    for th in header_elements:
        headers.append(extract_header_name(th))

    rows = []
    totals = None

    body_rows = table_element.find_elements(By.CSS_SELECTOR, "tbody tr")

    for row in body_rows:
        th = row.find_element(By.CSS_SELECTOR, "th")
        row_name = element_text(th)
        row_class = th.get_attribute("class") or ""

        values = []
        td_elements = row.find_elements(By.CSS_SELECTOR, "td")
        for td in td_elements:
            values.append(coerce_stat_value(element_text(td)))

        row_dict = {}

        if headers:
            row_dict["player_name"] = row_name

            player_source_id = extract_id_from_class(row_class, "Opta-Player-")
            if player_source_id:
                row_dict["source_player_id"] = player_source_id

            stat_headers = headers[1:] if len(headers) > 1 else []

            stats = {}
            for i, header_name in enumerate(stat_headers):
                value = values[i] if i < len(values) else ""
                stats[header_name] = value

            row_dict["stats"] = stats
        else:
            row_dict["player_name"] = row_name
            row_dict["stats"] = values

        is_total = ("Opta-Total" in row_class) or (row_name.lower() == "total")

        if is_total:
            totals = row_dict
        else:
            rows.append(row_dict)

    return {
        "headers": headers,
        "rows": rows,
        "totals": totals,
    }


def extract_player_stats_sections(driver):
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

            parsed_table = parse_player_table(table)

            sections.append({
                "section_title": section_title,
                "team_source_id": team_source_id,
                "wrapper_class": wrapper_class,
                "table": parsed_table,
            })

    return sections


def build_output(driver):
    return {
        "match_info": extract_match_info(driver),
        "incidents": extract_incidents(driver),
        "player_stats_sections": extract_player_stats_sections(driver),
    }


def save_output_files(driver, data: dict, output_dir: Path):
    json_path = output_dir / "match_summary_parsed.json"
    screenshot_path = output_dir / "match_summary_page.png"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    driver.save_screenshot(str(screenshot_path))

    logging.info(f"JSON kaydedildi: {json_path}")
    logging.info(f"Ekran görüntüsü kaydedildi: {screenshot_path}")

    if SAVE_HTML_COPY:
        html_path = output_dir / "match_summary_page_source.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        logging.info(f"HTML kaydedildi: {html_path}")


def print_output_summary(data: dict):
    match_info = data["match_info"]
    incidents = data["incidents"]
    sections = data["player_stats_sections"]

    print("\n========== PARSE ÖZETİ ==========")
    print("Maç:", match_info["home_team"]["name"], "-", match_info["away_team"]["name"])
    print("Skor:", match_info["home_team"]["score"], "-", match_info["away_team"]["score"])
    print("Lig:", match_info["competition"])
    print("Tarih:", match_info["match_date_text"])
    print("Venue:", match_info["venue"])
    print("Attendance:", match_info["attendance_text"])
    print("Referee:", match_info["referee"])
    print("Source match id:", match_info["source_match_id"])

    print("\n--- Incident sayıları ---")
    print("Home incidents:", len(incidents["home"]))
    print("Away incidents:", len(incidents["away"]))
    print("Timeline incidents:", len(incidents["timeline"]))

    print("\n--- Player stats section sayısı ---")
    print("Section count:", len(sections))

    for idx, section in enumerate(sections, start=1):
        section_title = section["section_title"]
        team_source_id = section["team_source_id"]
        row_count = len(section["table"]["rows"])
        total_exists = section["table"]["totals"] is not None

        print(
            f"{idx}. title={section_title} | "
            f"team_source_id={team_source_id} | "
            f"rows={row_count} | totals={total_exists}"
        )


def main():
    setup_logging()
    output_dir = ensure_output_dir()
    driver = create_driver()

    try:
        logging.info("Sayfa açılıyor...")
        driver.get(MATCH_URL)

        wait_for_page(driver)
        accept_cookies(driver)

        wait_for_match_summary_widgets(driver)

        parsed_data = build_output(driver)
        print_output_summary(parsed_data)
        save_output_files(driver, parsed_data, output_dir)

        logging.info("Match summary parse tamamlandı.")

        if KEEP_BROWSER_OPEN:
            input("\nTarayıcı açık bırakıldı. Kapatmak için Enter'a bas...")

    except TimeoutException:
        logging.error("Sayfa veya widget zamanında yüklenmedi.")
    except Exception as e:
        logging.exception(f"Beklenmeyen hata oluştu: {e}")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()