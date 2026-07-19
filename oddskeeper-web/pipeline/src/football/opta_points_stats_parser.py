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
OPTA_POINTS_URL = MATCH_SUMMARY_URL.replace("/match-summary", "/opta-points")

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
    output_dir = get_project_root() / "data" / "raw" / "opta_points_stats"
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


def wait_for_opta_points_widget(driver):
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.ID, "Opta_2"))
    )
    time.sleep(1.5)


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
        "page_type": "opta-points-stats",
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


def get_tab_nav_items(container):
    return container.find_elements(By.CSS_SELECTOR, "div.Opta-Nav ul li")


def get_tab_sections(container):
    return container.find_elements(By.CSS_SELECTOR, "ul.Opta-TabbedContent > li")


def click_tab_by_index(container, driver, index: int):
    nav_items = get_tab_nav_items(container)
    sections = get_tab_sections(container)

    if index >= len(nav_items) or index >= len(sections):
        raise IndexError("Tab index geçersiz.")

    tab = nav_items[index]
    link = tab.find_element(By.TAG_NAME, "a")
    driver.execute_script("arguments[0].click();", link)

    WebDriverWait(driver, 10).until(
        lambda d: "Opta-On" in get_tab_nav_items(container)[index].get_attribute("class")
    )
    WebDriverWait(driver, 10).until(
        lambda d: "Opta-On" in get_tab_sections(container)[index].get_attribute("class")
    )
    time.sleep(0.8)


def activate_stats_mode_for_active_section(container, index: int, driver):
    sections = get_tab_sections(container)
    section = sections[index]

    stats_button = section.find_element(By.CSS_SELECTOR, 'button[value="stats"]')
    points_button = section.find_element(By.CSS_SELECTOR, 'button[value="points"]')

    stats_class = stats_button.get_attribute("class") or ""
    if "Opta-On" in stats_class:
        return "stats"

    driver.execute_script("arguments[0].click();", stats_button)

    def stats_is_active(_):
        refreshed_section = get_tab_sections(container)[index]
        refreshed_stats_button = refreshed_section.find_element(By.CSS_SELECTOR, 'button[value="stats"]')
        refreshed_points_button = refreshed_section.find_element(By.CSS_SELECTOR, 'button[value="points"]')

        stats_on = "Opta-On" in (refreshed_stats_button.get_attribute("class") or "")
        points_off = "Opta-On" not in (refreshed_points_button.get_attribute("class") or "")
        return stats_on and points_off

    WebDriverWait(driver, 10).until(stats_is_active)
    time.sleep(1)

    return "stats"


def get_header_key_and_label(th, col_index: int):
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


def parse_stats_table(table):
    header_elements = table.find_elements(By.CSS_SELECTOR, "thead tr th")
    headers = []

    for idx, th in enumerate(header_elements):
        key, label = get_header_key_and_label(th, idx)
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

        position_full = ""
        try:
            abbr = position_cell.find_element(By.TAG_NAME, "abbr")
            position_full = clean_text(abbr.get_attribute("title") or abbr.text)
        except Exception:
            position_full = position_code

        td_elements = row.find_elements(By.CSS_SELECTOR, "td")
        stats = {}

        stat_headers = headers[2:]
        for i, header in enumerate(stat_headers):
            if i >= len(td_elements):
                stats[header["key"]] = ""
                continue

            td = td_elements[i]
            value = coerce_value(element_text(td))
            stats[header["key"]] = value

        rows.append({
            "player_name": player_name,
            "source_player_id": player_source_id,
            "player_side": row_side,
            "lineup_status": lineup_status,
            "position_code": position_code,
            "position_full": position_full,
            "stats": stats
        })

    return {
        "headers": headers,
        "row_count": len(rows),
        "rows": rows
    }


def extract_team_source_id_from_wrapper(wrapper):
    class_value = wrapper.get_attribute("class") or ""
    return extract_id_from_class(class_value, "Opta-Team-")


def extract_sections(driver):
    container = driver.find_element(By.ID, "Opta_2")
    results = []

    nav_items = get_tab_nav_items(container)
    if not nav_items:
        raise ValueError("Opta Points tab yapısı bulunamadı.")

    for idx in range(len(nav_items)):
        click_tab_by_index(container, driver, idx)
        active_mode = activate_stats_mode_for_active_section(container, idx, driver)

        sections = get_tab_sections(container)
        section = sections[idx]

        section_title = safe_find_text(section, By.CSS_SELECTOR, "h3.Opta-Exp span")
        wrappers = section.find_elements(By.CSS_SELECTOR, "div.Opta-Team")

        if not wrappers:
            logging.warning(f"{section_title} için Opta-Team wrapper bulunamadı.")
            continue

        wrapper = wrappers[0]
        team_source_id = extract_team_source_id_from_wrapper(wrapper)

        table = wrapper.find_element(By.CSS_SELECTOR, "table.Opta-Striped")
        table_data = parse_stats_table(table)

        results.append({
            "section_title": section_title,
            "team_source_id": team_source_id,
            "active_mode": active_mode,
            "table": table_data
        })

    return results


def build_output(driver):
    return {
        "match_info": extract_match_info(driver),
        "stats_sections": extract_sections(driver)
    }


def save_output_files(driver, data: dict, output_dir: Path):
    json_path = output_dir / "opta_points_stats_parsed.json"
    screenshot_path = output_dir / "opta_points_stats_page.png"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    driver.save_screenshot(str(screenshot_path))

    logging.info(f"JSON kaydedildi: {json_path}")
    logging.info(f"Ekran görüntüsü kaydedildi: {screenshot_path}")

    if SAVE_HTML_COPY:
        html_path = output_dir / "opta_points_stats_page_source.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        logging.info(f"HTML kaydedildi: {html_path}")


def print_summary(data: dict):
    match_info = data["match_info"]
    sections = data["stats_sections"]

    print("\n========== OPTA POINTS STATS PARSE ÖZETİ ==========")
    print("Maç:", match_info["home_team"]["name"], "-", match_info["away_team"]["name"])
    print("Skor:", match_info["home_team"]["score"], "-", match_info["away_team"]["score"])
    print("Lig:", match_info["competition"])
    print("Tarih:", match_info["match_date_text"])
    print("Source match id:", match_info["source_match_id"])

    print("\n--- Section özeti ---")
    for i, section in enumerate(sections, start=1):
        title = section["section_title"]
        team_source_id = section["team_source_id"]
        active_mode = section["active_mode"]
        row_count = section["table"]["row_count"]

        print(
            f"{i}. title={title} | "
            f"team_source_id={team_source_id} | "
            f"mode={active_mode} | "
            f"rows={row_count}"
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
        logging.info("Opta Points Stats sayfası açılıyor...")
        driver.get(OPTA_POINTS_URL)

        wait_for_page(driver)
        accept_cookies(driver)
        wait_for_opta_points_widget(driver)

        parsed_data = build_output(driver)
        print_summary(parsed_data)
        save_output_files(driver, parsed_data, output_dir)

        logging.info("Opta Points Stats parse tamamlandı.")

        if KEEP_BROWSER_OPEN:
            input("\nTarayıcı açık bırakıldı. Kapatmak için Enter'a bas...")

    except TimeoutException:
        logging.error("Sayfa veya Opta Points widget zamanında yüklenmedi.")
    except Exception as e:
        logging.exception(f"Beklenmeyen hata oluştu: {e}")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()