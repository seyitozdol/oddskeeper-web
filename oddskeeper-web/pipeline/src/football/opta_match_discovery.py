import json
import logging
import time
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


MATCH_URL = "https://optaplayerstats.statsperform.com/en_GB/soccer/s%C3%BCper-lig-2025-2026/97zghcaoec1isvvdkh9ud50d0/match/view/888oseoozq8b89mcdl2mis2l0/match-summary"
WAIT_AFTER_LOAD_SECONDS = 6
KEEP_BROWSER_OPEN = True
MAX_TEXT_ITEMS = 40


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s"
    )


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def ensure_output_dir() -> Path:
    output_dir = get_project_root() / "data" / "raw" / "opta_discovery"
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def create_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    driver = webdriver.Chrome(options=options)
    return driver


def accept_cookies(driver):
    try:
        WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable((By.ID, "onetrust-accept-btn-handler"))
        ).click()
        logging.info("Çerez onayı verildi.")
    except Exception:
        logging.info("Çerez butonu bulunamadı veya tıklanamadı.")


def wait_for_page(driver):
    WebDriverWait(driver, 30).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )
    time.sleep(WAIT_AFTER_LOAD_SECONDS)


def safe_text(value):
    if value is None:
        return ""
    return " ".join(value.split()).strip()


def shorten_text(text, max_len=200):
    text = safe_text(text)
    if len(text) <= max_len:
        return text
    return text[:max_len] + "..."


def collect_unique_texts(elements, limit=MAX_TEXT_ITEMS):
    results = []
    seen = set()

    for el in elements:
        try:
            text = safe_text(el.text)
            if not text:
                continue
            if text in seen:
                continue
            seen.add(text)
            results.append(text)
            if len(results) >= limit:
                break
        except Exception:
            continue

    return results


def collect_headings(driver):
    elements = driver.find_elements(By.CSS_SELECTOR, "h1, h2, h3, h4")
    return collect_unique_texts(elements)


def collect_buttons(driver):
    elements = driver.find_elements(By.CSS_SELECTOR, "button")
    return collect_unique_texts(elements)


def collect_links(driver):
    elements = driver.find_elements(By.CSS_SELECTOR, "a")
    filtered = []

    for el in elements:
        try:
            text = safe_text(el.text)
            href = el.get_attribute("href")
            if not text:
                continue
            filtered.append({
                "text": text,
                "href": href
            })
        except Exception:
            continue

    unique = []
    seen = set()

    for item in filtered:
        key = (item["text"], item["href"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
        if len(unique) >= MAX_TEXT_ITEMS:
            break

    return unique


def collect_tables(driver):
    tables = driver.find_elements(By.CSS_SELECTOR, "table")
    table_data = []

    for i, table in enumerate(tables, start=1):
        try:
            headers = []
            header_elements = table.find_elements(By.CSS_SELECTOR, "th")
            for h in header_elements:
                h_text = safe_text(h.text)
                if h_text:
                    headers.append(h_text)

            first_row = []
            row_elements = table.find_elements(By.CSS_SELECTOR, "tbody tr")
            if row_elements:
                first_cells = row_elements[0].find_elements(By.CSS_SELECTOR, "td")
                for cell in first_cells:
                    cell_text = safe_text(cell.text)
                    if cell_text:
                        first_row.append(cell_text)

            table_data.append({
                "index": i,
                "id": table.get_attribute("id"),
                "class": table.get_attribute("class"),
                "headers": headers[:20],
                "first_row_sample": first_row[:20],
            })
        except Exception:
            table_data.append({
                "index": i,
                "error": "table okunamadı"
            })

    return table_data


def collect_opta_like_elements(driver):
    elements = driver.find_elements(
        By.CSS_SELECTOR,
        '[id*="Opta"], [id*="opta"], [class*="Opta"], [class*="opta"]'
    )

    results = []
    seen = set()

    for el in elements:
        try:
            tag_name = el.tag_name
            el_id = el.get_attribute("id")
            el_class = el.get_attribute("class")
            el_text = shorten_text(el.text, 250)

            key = (tag_name, el_id, el_class, el_text)
            if key in seen:
                continue
            seen.add(key)

            results.append({
                "tag": tag_name,
                "id": el_id,
                "class": el_class,
                "text_sample": el_text
            })

            if len(results) >= MAX_TEXT_ITEMS:
                break

        except Exception:
            continue

    return results


def collect_basic_summary(driver):
    body_text = ""
    try:
        body = driver.find_element(By.TAG_NAME, "body")
        body_text = shorten_text(body.text, 1500)
    except Exception:
        body_text = ""

    summary = {
        "page_title": driver.title,
        "current_url": driver.current_url,
        "headings": collect_headings(driver),
        "buttons": collect_buttons(driver),
        "links": collect_links(driver),
        "tables": collect_tables(driver),
        "opta_like_elements": collect_opta_like_elements(driver),
        "body_text_sample": body_text,
    }
    return summary


def save_outputs(driver, summary, output_dir: Path):
    json_path = output_dir / "match_discovery_summary.json"
    html_path = output_dir / "match_page_source.html"
    screenshot_path = output_dir / "match_page_screenshot.png"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(driver.page_source)

    driver.save_screenshot(str(screenshot_path))

    logging.info(f"JSON kaydedildi: {json_path}")
    logging.info(f"HTML kaydedildi: {html_path}")
    logging.info(f"Ekran görüntüsü kaydedildi: {screenshot_path}")


def print_summary(summary):
    print("\n========== SAYFA ÖZETİ ==========")
    print("Başlık:", summary["page_title"])
    print("URL:", summary["current_url"])

    print("\n--- Headings ---")
    for item in summary["headings"]:
        print("-", item)

    print("\n--- Buttons ---")
    for item in summary["buttons"]:
        print("-", item)

    print("\n--- Links (ilk kayıtlar) ---")
    for item in summary["links"][:15]:
        print(f"- {item['text']} | {item['href']}")

    print("\n--- Tables ---")
    if not summary["tables"]:
        print("Tablo bulunamadı.")
    else:
        for table in summary["tables"]:
            print(table)

    print("\n--- Opta benzeri elementler ---")
    if not summary["opta_like_elements"]:
        print("Opta benzeri id/class element bulunamadı.")
    else:
        for item in summary["opta_like_elements"][:15]:
            print(item)

    print("\n--- Body text sample ---")
    print(summary["body_text_sample"])


def main():
    setup_logging()
    output_dir = ensure_output_dir()

    driver = create_driver()

    try:
        logging.info("Sayfa açılıyor...")
        driver.get(MATCH_URL)

        wait_for_page(driver)
        accept_cookies(driver)

        # Cookie sonrası kısa bekleme
        time.sleep(3)

        summary = collect_basic_summary(driver)
        print_summary(summary)
        save_outputs(driver, summary, output_dir)

        logging.info("Keşif tamamlandı.")

        if KEEP_BROWSER_OPEN:
            input("\nTarayıcı açık bırakıldı. Kapatmak için Enter'a bas...")

    except TimeoutException:
        logging.error("Sayfa zamanında yüklenmedi.")
    except Exception as e:
        logging.exception(f"Beklenmeyen hata oluştu: {e}")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()