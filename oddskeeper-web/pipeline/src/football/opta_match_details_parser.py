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


MATCH_SUMMARY_URL = "https://optaplayerstats.statsperform.com/en_GB/soccer/s%C3%BCper-lig-2025-2026/97zghcaoec1isvvdkh9ud50d0/match/view/888oseoozq8b89mcdl2mis2l0/match-summary"
MATCH_DETAILS_URL = MATCH_SUMMARY_URL.replace("/match-summary", "/match-details")

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
    output_dir = get_project_root() / "data" / "raw" / "opta_match_details"
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

    # Stat hücrelerinde virgül genelde decimal anlamına geliyor: 0,063 / 1,845
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


def wait_for_match_details_widget(driver):
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.ID, "opta-player-stats-container"))
    )
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "playerstats-match"))
    )
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "playerstats-match table.Opta-Striped"))
    )
    time.sleep(1.5)


def safe_find_text(parent, by, selector, default=""):
    try:
        el = parent.find_element(by, selector)
        return element_text(el)
    except Exception:
        return default


def extract_match_info(driver):
    info = {
        "source": "opta",
        "page_type": "match-details",
        "match_url": driver.current_url,
        "page_title": driver.title,
    }

    try:
        container = driver.find_element(By.ID, "Opta_0")
        meta_block = container.find_element(By.CSS_SELECTOR, ".Opta-Cf[data-match]")

        info["source_match_id"] = meta_block.get_attribute("data-match")
        info["raw_match_date_ms"] = meta_block.get_attribute("data-date")
        info["winner_team_source_id"] = meta_block.get_attribute("data-match_winner_id")
        info["winner_side"] = meta_block.get_attribute("data-match_winner_side")

        team_name_cells = container.find_elements(By.CSS_SELECTOR, "td.Opta-TeamName")
        score_spans = container.find_elements(By.CSS_SELECTOR, "span.Opta-Team-Score")

        if len(team_name_cells) >= 2:
            info["home_team"] = {
                "name": element_text(team_name_cells[0]),
                "source_team_id": extract_id_from_class(team_name_cells[0].get_attribute("class"), "Opta-Team-"),
                "score": parse_int(element_text(score_spans[0])) if len(score_spans) >= 1 else None,
            }
            info["away_team"] = {
                "name": element_text(team_name_cells[1]),
                "source_team_id": extract_id_from_class(team_name_cells[1].get_attribute("class"), "Opta-Team-"),
                "score": parse_int(element_text(score_spans[1])) if len(score_spans) >= 2 else None,
            }

        details = {}
        detail_rows = container.find_elements(By.CSS_SELECTOR, "div.Opta-Matchdata dl")
        for row in detail_rows:
            key = safe_find_text(row, By.TAG_NAME, "dt")
            value = safe_find_text(row, By.TAG_NAME, "dd")
            if key:
                details[key.lower()] = value

        info["competition"] = safe_find_text(container, By.CSS_SELECTOR, "span.Opta-Competition")
        info["match_date_text"] = safe_find_text(container, By.CSS_SELECTOR, "span.Opta-Date")
        info["venue"] = details.get("venue", "")
        info["attendance_text"] = details.get("attendance", "")
        info["attendance"] = parse_int(details.get("attendance", ""))
        info["referee"] = details.get("referee", "")

    except Exception:
        pass

    return info


def get_main_component(driver):
    return driver.find_element(By.CSS_SELECTOR, "playerstats-match")


def get_tab_titles_from_page(driver):
    links = driver.find_elements(By.CSS_SELECTOR, "playerstats-match ul.Opta-Cf > li > a")
    titles = []

    for link in links:
        text = element_text(link)
        if text and text not in titles:
            titles.append(text)

    return titles


def get_active_tab_title(driver):
    try:
        active_link = driver.find_element(By.CSS_SELECTOR, "playerstats-match ul.Opta-Cf > li.Opta-On a")
        return element_text(active_link)
    except Exception:
        return ""


def get_active_section(component):
    try:
        return component.find_element(By.CSS_SELECTOR, "ul.Opta-TabbedContent > li.Opta-On")
    except Exception:
        sections = component.find_elements(By.CSS_SELECTOR, "ul.Opta-TabbedContent > li")
        if not sections:
            raise ValueError("Aktif Match Details section bulunamadı.")
        return sections[0]


def click_tab_by_title(driver, title: str):
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
            active_title = get_active_tab_title(d)
            component = get_main_component(d)
            active_section = get_active_section(component)
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


def build_columns(table):
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


def parse_total_row(row, columns):
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


def parse_player_row(row, columns):
    player_cell = row.find_element(By.CSS_SELECTOR, "th.Opta-Player")
    player_name = element_text(player_cell)
    player_class = player_cell.get_attribute("class") or ""

    if "Opta-Total" in player_class or player_name.lower() == "total":
        return None, "total"

    row_class = row.get_attribute("class") or ""

    player_side = None
    if "side-home" in row_class:
        player_side = "home"
    elif "side-away" in row_class:
        player_side = "away"

    source_player_id = extract_id_from_class(player_class, "Opta-Player-")
    lineup_status = detect_lineup_status(player_cell)

    tds = row.find_elements(By.CSS_SELECTOR, "td")
    if not tds:
        return None, "skip"

    position_code = element_text(tds[0]) if len(tds) >= 1 else ""

    stats = {}
    stat_columns = columns[2:]

    for i, column in enumerate(stat_columns):
        td_index = i + 1
        if td_index >= len(tds):
            stats[column["key"]] = ""
            continue

        stats[column["key"]] = coerce_value(element_text(tds[td_index]))

    row_data = {
        "player_name": player_name,
        "source_player_id": source_player_id,
        "player_side": player_side,
        "lineup_status": lineup_status,
        "position_code": position_code,
        "stats": stats
    }

    return row_data, "player"


def parse_table(table):
    columns = build_columns(table)
    body_rows = table.find_elements(By.CSS_SELECTOR, "tbody tr")

    players = []
    totals = None

    for row in body_rows:
        row_data, row_type = parse_player_row(row, columns)

        if row_type == "player" and row_data is not None:
            players.append(row_data)
        elif row_type == "total":
            totals = parse_total_row(row, columns)

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


def extract_sections(driver, match_info: dict):
    tab_titles = get_tab_titles_from_page(driver)

    if not tab_titles:
        raise ValueError("Match Details sekmeleri bulunamadı.")

    results = []

    for section_title in tab_titles:
        click_tab_by_title(driver, section_title)

        component = get_main_component(driver)
        active_section = get_active_section(component)

        table = active_section.find_element(By.CSS_SELECTOR, "table.Opta-Striped")
        table_data = parse_table(table)

        results.append({
            "section_title": section_title,
            "team_source_id": map_section_team_id(section_title, match_info),
            "table": table_data
        })

    return results


def build_output(driver):
    match_info = extract_match_info(driver)

    return {
        "match_info": match_info,
        "details_sections": extract_sections(driver, match_info)
    }


def save_output_files(driver, data: dict, output_dir: Path):
    json_path = output_dir / "match_details_parsed.json"
    screenshot_path = output_dir / "match_details_page.png"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    driver.save_screenshot(str(screenshot_path))

    logging.info(f"JSON kaydedildi: {json_path}")
    logging.info(f"Ekran görüntüsü kaydedildi: {screenshot_path}")

    if SAVE_HTML_COPY:
        html_path = output_dir / "match_details_page_source.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        logging.info(f"HTML kaydedildi: {html_path}")


def print_summary(data: dict):
    match_info = data["match_info"]
    sections = data["details_sections"]

    print("\n========== MATCH DETAILS PARSE ÖZETİ ==========")
    print("Maç:", match_info.get("home_team", {}).get("name"), "-", match_info.get("away_team", {}).get("name"))
    print("Skor:", match_info.get("home_team", {}).get("score"), "-", match_info.get("away_team", {}).get("score"))
    print("Lig:", match_info.get("competition"))
    print("Tarih:", match_info.get("match_date_text"))
    print("Source match id:", match_info.get("source_match_id"))

    print("\n--- Section özeti ---")
    for i, section in enumerate(sections, start=1):
        title = section["section_title"]
        team_source_id = section["team_source_id"]
        row_count = section["table"]["row_count"]
        total_exists = section["table"]["totals"] is not None

        print(
            f"{i}. title={title} | "
            f"team_source_id={team_source_id} | "
            f"rows={row_count} | "
            f"totals={total_exists}"
        )

        if section["table"]["rows"]:
            first_player = section["table"]["rows"][0]
            print(
                f"   first_player={first_player['player_name']} | "
                f"side={first_player['player_side']} | "
                f"status={first_player['lineup_status']} | "
                f"position={first_player['position_code']}"
            )


def main():
    setup_logging()
    output_dir = ensure_output_dir()
    driver = create_driver()

    try:
        logging.info("Match Details parser başlıyor...")
        driver.get(MATCH_DETAILS_URL)

        wait_for_page(driver)
        accept_cookies(driver)
        wait_for_match_details_widget(driver)

        parsed_data = build_output(driver)
        print_summary(parsed_data)
        save_output_files(driver, parsed_data, output_dir)

        logging.info("Match Details parse tamamlandı.")

        if KEEP_BROWSER_OPEN:
            input("\nTarayıcı açık bırakıldı. Kapatmak için Enter'a bas...")

    except TimeoutException:
        logging.error("Sayfa veya Match Details widget zamanında yüklenmedi.")
    except Exception as e:
        logging.exception(f"Beklenmeyen hata oluştu: {e}")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()