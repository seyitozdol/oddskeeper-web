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
MAX_WIDGET_TEXT_LEN = 500


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s"
    )


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def ensure_output_dir() -> Path:
    output_dir = get_project_root() / "data" / "raw" / "opta_points_discovery"
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


def shorten_text(text: str, max_len: int = MAX_WIDGET_TEXT_LEN) -> str:
    text = clean_text(text)
    if len(text) <= max_len:
        return text
    return text[:max_len] + "..."


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


def wait_for_opta_content(driver):
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.ID, "opta-player-stats-container"))
    )
    time.sleep(1.5)


def safe_find_all(parent, by, selector):
    try:
        return parent.find_elements(by, selector)
    except Exception:
        return []


def parse_table_preview(table):
    headers = []
    header_elements = safe_find_all(table, By.CSS_SELECTOR, "thead th")
    for th in header_elements[:25]:
        text = element_text(th)
        if not text:
            try:
                abbr = th.find_element(By.TAG_NAME, "abbr")
                text = clean_text(abbr.get_attribute("title") or abbr.text)
            except Exception:
                text = ""
        headers.append(text)

    first_row = []
    body_rows = safe_find_all(table, By.CSS_SELECTOR, "tbody tr")
    if body_rows:
        first_cells = body_rows[0].find_elements(By.CSS_SELECTOR, "th, td")
        for cell in first_cells[:25]:
            first_row.append(element_text(cell))

    return {
        "headers": headers,
        "first_row_sample": first_row,
    }


def collect_nav_links(driver):
    items = []
    links = safe_find_all(driver, By.CSS_SELECTOR, "#opta-player-stats-container .statspagenav a")

    for link in links:
        text = element_text(link)
        href = link.get_attribute("href")
        if text:
            items.append({
                "text": text,
                "href": href
            })

    return items


def collect_opta_widgets(driver):
    widgets = []
    elements = safe_find_all(driver, By.CSS_SELECTOR, '[id^="Opta_"]')

    for el in elements:
        widget_id = el.get_attribute("id")
        widget_class = el.get_attribute("class")
        widget_text = shorten_text(element_text(el), 600)

        tables = safe_find_all(el, By.CSS_SELECTOR, "table")
        table_previews = []

        for table in tables[:5]:
            table_previews.append(parse_table_preview(table))

        widgets.append({
            "id": widget_id,
            "class": widget_class,
            "text_sample": widget_text,
            "table_count": len(tables),
            "table_previews": table_previews,
        })

    return widgets


def collect_page_summary(driver):
    body_text = ""
    try:
        body = driver.find_element(By.TAG_NAME, "body")
        body_text = shorten_text(element_text(body), 1500)
    except Exception:
        body_text = ""

    return {
        "page_title": driver.title,
        "current_url": driver.current_url,
        "nav_links": collect_nav_links(driver),
        "opta_widgets": collect_opta_widgets(driver),
        "body_text_sample": body_text,
    }


def save_output_files(driver, data: dict, output_dir: Path):
    json_path = output_dir / "opta_points_discovery.json"
    screenshot_path = output_dir / "opta_points_page.png"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    driver.save_screenshot(str(screenshot_path))

    logging.info(f"JSON kaydedildi: {json_path}")
    logging.info(f"Ekran görüntüsü kaydedildi: {screenshot_path}")

    if SAVE_HTML_COPY:
        html_path = output_dir / "opta_points_page_source.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        logging.info(f"HTML kaydedildi: {html_path}")


def print_summary(data: dict):
    print("\n========== OPTA POINTS KEŞİF ÖZETİ ==========")
    print("Başlık:", data["page_title"])
    print("URL:", data["current_url"])

    print("\n--- Sayfa linkleri ---")
    for item in data["nav_links"]:
        print(f"- {item['text']} | {item['href']}")

    print("\n--- Widget sayısı ---")
    print(len(data["opta_widgets"]))

    for i, widget in enumerate(data["opta_widgets"], start=1):
        print(f"\n{i}. widget")
        print("id:", widget["id"])
        print("class:", widget["class"])
        print("table_count:", widget["table_count"])
        print("text_sample:", widget["text_sample"][:300])

        for j, table in enumerate(widget["table_previews"], start=1):
            print(f"  table_{j}_headers:", table["headers"][:15])
            print(f"  table_{j}_first_row:", table["first_row_sample"][:15])


def main():
    setup_logging()
    output_dir = ensure_output_dir()
    driver = create_driver()

    try:
        logging.info("Opta Points sayfası açılıyor...")
        driver.get(OPTA_POINTS_URL)

        wait_for_page(driver)
        accept_cookies(driver)
        wait_for_opta_content(driver)

        data = collect_page_summary(driver)
        print_summary(data)
        save_output_files(driver, data, output_dir)

        logging.info("Opta Points keşfi tamamlandı.")

        if KEEP_BROWSER_OPEN:
            input("\nTarayıcı açık bırakıldı. Kapatmak için Enter'a bas...")

    except TimeoutException:
        logging.error("Sayfa veya Opta Points içeriği zamanında yüklenmedi.")
    except Exception as e:
        logging.exception(f"Beklenmeyen hata oluştu: {e}")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()