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
    output_dir = get_project_root() / "data" / "raw" / "opta_match_details_deep_discovery"
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


def shorten_text(text: str, max_len: int = 500) -> str:
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


def wait_for_container(driver):
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.ID, "opta-player-stats-container"))
    )
    time.sleep(2)


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
        "row_count": len(body_rows)
    }


def get_dom_path(element):
    js = """
    const el = arguments[0];
    let current = el;
    const parts = [];

    while (current && current.nodeType === 1 && parts.length < 8) {
        let part = current.tagName.toLowerCase();

        if (current.id) {
            part += "#" + current.id;
        } else {
            const cls = (current.className || "").toString().trim().split(/\\s+/).filter(Boolean).slice(0, 2);
            if (cls.length) {
                part += "." + cls.join(".");
            }
        }

        parts.unshift(part);
        current = current.parentElement;
    }

    return parts.join(" > ");
    """
    try:
        return element.parent.execute_script(js, element)
    except Exception:
        return ""


def collect_direct_children(container):
    children = safe_find_all(container, By.XPATH, "./*")
    items = []

    for child in children:
        items.append({
            "tag": child.tag_name,
            "id": child.get_attribute("id"),
            "class": child.get_attribute("class"),
            "dom_path": get_dom_path(child),
            "text_sample": shorten_text(element_text(child), 600),
            "table_count": len(safe_find_all(child, By.CSS_SELECTOR, "table")),
            "button_count": len(safe_find_all(child, By.CSS_SELECTOR, "button")),
            "link_count": len(safe_find_all(child, By.CSS_SELECTOR, "a")),
        })

    return items


def collect_candidate_blocks(container):
    selectors = [
        '[id^="Opta_"]',
        '[class*="Opta"]',
        'table',
        'button',
        'a',
        'ul',
        'div'
    ]

    found = []
    seen = set()

    for selector in selectors:
        for el in safe_find_all(container, By.CSS_SELECTOR, selector):
            el_id = el.get_attribute("id")
            el_class = el.get_attribute("class")
            text = shorten_text(element_text(el), 500)
            key = (el.tag_name, el_id, el_class, text[:120])

            if key in seen:
                continue
            seen.add(key)

            found.append({
                "tag": el.tag_name,
                "id": el_id,
                "class": el_class,
                "dom_path": get_dom_path(el),
                "text_sample": text,
                "table_count": len(safe_find_all(el, By.CSS_SELECTOR, "table")),
                "button_count": len(safe_find_all(el, By.CSS_SELECTOR, "button")),
                "link_count": len(safe_find_all(el, By.CSS_SELECTOR, "a")),
            })

    found.sort(key=lambda x: (-(x["table_count"]), -(x["button_count"]), -(x["link_count"]), x["dom_path"]))
    return found[:120]


def collect_tables_with_context(container):
    tables = safe_find_all(container, By.CSS_SELECTOR, "table")
    items = []

    for idx, table in enumerate(tables[:80], start=1):
        items.append({
            "index": idx,
            "dom_path": get_dom_path(table),
            "class": table.get_attribute("class"),
            "preview": parse_table_preview(table)
        })

    return items


def collect_buttons_and_links(container):
    buttons = []
    links = []

    for btn in safe_find_all(container, By.CSS_SELECTOR, "button")[:80]:
        buttons.append({
            "text": element_text(btn),
            "class": btn.get_attribute("class"),
            "value": btn.get_attribute("value"),
            "dom_path": get_dom_path(btn)
        })

    for link in safe_find_all(container, By.CSS_SELECTOR, "a")[:120]:
        text = element_text(link)
        href = link.get_attribute("href")
        if text or href:
            links.append({
                "text": text,
                "href": href,
                "class": link.get_attribute("class"),
                "dom_path": get_dom_path(link)
            })

    return {
        "buttons": buttons,
        "links": links
    }


def collect_specific_keyword_hits(container):
    keywords = [
        "Match Details",
        "Starter",
        "Substitute",
        "Home",
        "Away",
        "Kayseri Spor Kulübü",
        "Kasımpaşa Spor Kulübü",
        "Stats",
        "Player",
        "Defender",
        "Midfielder",
        "Forward",
        "Goalkeeper"
    ]

    hits = []

    all_elements = safe_find_all(container, By.CSS_SELECTOR, "*")
    for el in all_elements[:1500]:
        text = element_text(el)
        if not text:
            continue

        matched = [kw for kw in keywords if kw.lower() in text.lower()]
        if matched:
            hits.append({
                "tag": el.tag_name,
                "id": el.get_attribute("id"),
                "class": el.get_attribute("class"),
                "dom_path": get_dom_path(el),
                "matched_keywords": matched,
                "text_sample": shorten_text(text, 400)
            })

    return hits[:120]


def collect_page_summary(driver):
    container = driver.find_element(By.ID, "opta-player-stats-container")

    return {
        "page_title": driver.title,
        "current_url": driver.current_url,
        "direct_children": collect_direct_children(container),
        "candidate_blocks": collect_candidate_blocks(container),
        "tables_with_context": collect_tables_with_context(container),
        "buttons_and_links": collect_buttons_and_links(container),
        "keyword_hits": collect_specific_keyword_hits(container),
        "container_text_sample": shorten_text(element_text(container), 2000)
    }


def save_output_files(driver, data: dict, output_dir: Path):
    json_path = output_dir / "match_details_deep_discovery.json"
    screenshot_path = output_dir / "match_details_deep_page.png"
    container_html_path = output_dir / "match_details_container.html"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    driver.save_screenshot(str(screenshot_path))

    container = driver.find_element(By.ID, "opta-player-stats-container")
    with open(container_html_path, "w", encoding="utf-8") as f:
        f.write(container.get_attribute("outerHTML"))

    logging.info(f"JSON kaydedildi: {json_path}")
    logging.info(f"Ekran görüntüsü kaydedildi: {screenshot_path}")
    logging.info(f"Container HTML kaydedildi: {container_html_path}")

    if SAVE_HTML_COPY:
        html_path = output_dir / "match_details_page_source.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        logging.info(f"HTML kaydedildi: {html_path}")


def print_summary(data):
    print("\n========== MATCH DETAILS DEEP KEŞİF ==========")
    print("Başlık:", data["page_title"])
    print("URL:", data["current_url"])

    print("\n--- Direct children ---")
    for idx, item in enumerate(data["direct_children"], start=1):
        print(
            f"{idx}. tag={item['tag']} | id={item['id']} | class={item['class']} | "
            f"tables={item['table_count']} | buttons={item['button_count']} | links={item['link_count']}"
        )
        print("   path:", item["dom_path"])
        print("   text:", item["text_sample"][:250])

    print("\n--- Candidate blocks (ilk 20) ---")
    for idx, item in enumerate(data["candidate_blocks"][:20], start=1):
        print(
            f"{idx}. tag={item['tag']} | id={item['id']} | class={item['class']} | "
            f"tables={item['table_count']} | buttons={item['button_count']} | links={item['link_count']}"
        )
        print("   path:", item["dom_path"])
        print("   text:", item["text_sample"][:200])

    print("\n--- Tables with context (ilk 20) ---")
    for item in data["tables_with_context"][:20]:
        print(f"table_{item['index']} | class={item['class']}")
        print("  path:", item["dom_path"])
        print("  headers:", item["preview"]["headers"][:15])
        print("  first_row:", item["preview"]["first_row_sample"][:15])
        print("  row_count:", item["preview"]["row_count"])

    print("\n--- Buttons (ilk 20) ---")
    for item in data["buttons_and_links"]["buttons"][:20]:
        print(item)

    print("\n--- Links (ilk 20) ---")
    for item in data["buttons_and_links"]["links"][:20]:
        print(item)

    print("\n--- Keyword hits (ilk 20) ---")
    for item in data["keyword_hits"][:20]:
        print(item)


def main():
    setup_logging()
    output_dir = ensure_output_dir()
    driver = create_driver()

    try:
        logging.info("Match Details deep discovery başlıyor...")
        driver.get(MATCH_DETAILS_URL)

        wait_for_page(driver)
        accept_cookies(driver)
        wait_for_container(driver)

        data = collect_page_summary(driver)
        print_summary(data)
        save_output_files(driver, data, output_dir)

        logging.info("Match Details deep discovery tamamlandı.")

        if KEEP_BROWSER_OPEN:
            input("\nTarayıcı açık bırakıldı. Kapatmak için Enter'a bas...")

    except TimeoutException:
        logging.error("Sayfa veya container zamanında yüklenmedi.")
    except Exception as e:
        logging.exception(f"Beklenmeyen hata oluştu: {e}")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()