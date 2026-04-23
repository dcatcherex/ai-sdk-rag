"""Grade all eval runs for edlab-ads skill, iteration 1."""
import json, re, os
from pathlib import Path

WORKSPACE = Path(__file__).parent / "iteration-1"

def read(path):
    try:
        return Path(path).read_text(encoding="utf-8")
    except:
        return ""

def grade_eval1(with_text, without_text):
    results_with = []
    results_without = []

    def check(text, results):
        results.append({"text": "presents_two_options", "passed": "ตัวเลือก A" in text and "ตัวเลือก B" in text, "evidence": "Found both option labels" if "ตัวเลือก A" in text else "Missing option labels"})
        results.append({"text": "different_angles", "passed": bool(re.search(r"ตัวเลือก A.*?\n.*?—.*?\n.*?ตัวเลือก B.*?—", text, re.DOTALL)) and ("Aspiration" in text or "Urgency" in text or "อยากเป็นหมอ" in text or "CPR" in text or "Portfolio" in text), "evidence": "Options appear to have distinct angle labels"})
        has_prompt = "Color palette:" in text and "Image Generation Prompt" in text
        results.append({"text": "no_premature_generation", "passed": not has_prompt, "evidence": "Did not generate full image prompt" if not has_prompt else "FAIL: generated prompt before user chose"})
        has_question = "เลือก A หรือ B" in text or "A หรือ B" in text or "เลือก" in text
        results.append({"text": "ends_with_question", "passed": has_question, "evidence": "Found choice question" if has_question else "No choice question found"})
        has_edlab = "EdLab" in text or "Medical Shadowing" in text
        results.append({"text": "brand_aware", "passed": has_edlab, "evidence": "Contains EdLab/Medical Shadowing brand" if has_edlab else "No brand content found"})

    check(with_text, results_with)
    check(without_text, results_without)
    return results_with, results_without

def grade_eval3(with_text, without_text):
    results_with = []
    results_without = []

    def check(text, results):
        results.append({"text": "presents_two_options", "passed": "ตัวเลือก A" in text and "ตัวเลือก B" in text, "evidence": "Found both option labels" if "ตัวเลือก A" in text else "Missing option labels"})
        urgency = "ที่นั่ง" in text or "Urgency" in text or "urgency" in text or "Limited Seats" in text
        results.append({"text": "urgency_option_present", "passed": urgency, "evidence": "Urgency angle detected in options" if urgency else "No urgency angle found"})
        two_photo = "Variant B" in text or "hero" in text or "inset" in text or "2 ภาพ" in text or "two photo" in text.lower() or "Photo layout" in text
        results.append({"text": "mentions_two_photo_layout", "passed": two_photo, "evidence": "Mentioned photo layout / Variant B" if two_photo else "No photo layout mention"})
        has_prompt = "Color palette:" in text and "Image Generation Prompt" in text
        results.append({"text": "no_premature_generation", "passed": not has_prompt, "evidence": "Correctly waited for user" if not has_prompt else "FAIL: generated prompt early"})
        has_edlab = "EdLab" in text or "Medical Shadowing" in text
        results.append({"text": "brand_aware", "passed": has_edlab, "evidence": "Contains EdLab brand" if has_edlab else "No brand content"})

    check(with_text, results_with)
    check(without_text, results_without)
    return results_with, results_without

def grade_eval4(with_text, without_text):
    results_with = []
    results_without = []

    def check(text, results):
        headline = "เปิดรับสมัครแล้ว" in text and "ก.ย. 2568" in text
        results.append({"text": "custom_headline_applied", "passed": headline, "evidence": "Found custom headline in output" if headline else "Custom headline missing"})
        date_ok = "20 กันยายน" in text
        results.append({"text": "date_injected", "passed": date_ok, "evidence": "Date 20 กันยายน present" if date_ok else "Date not found"})
        loc_ok = "โรงพยาบาลนวมินทร์ 9" in text
        results.append({"text": "location_injected", "passed": loc_ok, "evidence": "Location นวมินทร์ 9 present" if loc_ok else "Location not found"})
        contact_ok = "@460zcthc" in text
        results.append({"text": "contact_block_present", "passed": contact_ok, "evidence": "Found @460zcthc contact" if contact_ok else "Contact block missing"})
        hashtag_ok = "#EdlabExperience" in text
        results.append({"text": "hashtags_present", "passed": hashtag_ok, "evidence": "Found EdLab hashtags" if hashtag_ok else "Hashtags missing"})
        colors_ok = "#085d6e" in text or "085d6e" in text
        results.append({"text": "brand_colors_in_prompt", "passed": colors_ok, "evidence": "Brand hex color present" if colors_ok else "Brand color missing"})
        logo_ok = "top-right" in text or "top right" in text
        results.append({"text": "logo_placement_specified", "passed": logo_ok, "evidence": "Logo top-right placement specified" if logo_ok else "Logo placement not specified"})
        brackets = bool(re.search(r'\[(?!ONLY|optional|Optional|if )[A-Z_]+\]', text))
        results.append({"text": "no_unresolved_brackets", "passed": not brackets, "evidence": "No unfilled placeholders" if not brackets else "Found unresolved brackets"})

    check(with_text, results_with)
    check(without_text, results_without)
    return results_with, results_without

def save_grading(eval_dir, run_name, assertions):
    path = WORKSPACE / eval_dir / run_name / "grading.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"assertions": assertions}, indent=2, ensure_ascii=False), encoding="utf-8")
    passed = sum(1 for a in assertions if a["passed"])
    print(f"  {run_name}: {passed}/{len(assertions)} passed")

evals = [
    ("eval-1-minimal-thai", grade_eval1),
    ("eval-2-minimal-english", grade_eval1),
    ("eval-3-urgency-two-photos", grade_eval3),
    ("eval-4-user-picks-edits", grade_eval4),
]

for eval_dir, grade_fn in evals:
    print(f"\n{eval_dir}")
    with_text = read(WORKSPACE / eval_dir / "with_skill" / "outputs" / "response.md")
    without_text = read(WORKSPACE / eval_dir / "without_skill" / "outputs" / "response.md")
    r_with, r_without = grade_fn(with_text, without_text)
    save_grading(eval_dir, "with_skill", r_with)
    save_grading(eval_dir, "without_skill", r_without)

# Aggregate
print("\n\n=== BENCHMARK SUMMARY ===")
all_with, all_without = [], []
for eval_dir, _ in evals:
    for run in ["with_skill", "without_skill"]:
        g = json.loads((WORKSPACE / eval_dir / run / "grading.json").read_text(encoding="utf-8"))
        total = len(g["assertions"])
        passed = sum(1 for a in g["assertions"] if a["passed"])
        rate = passed/total if total else 0
        if run == "with_skill":
            all_with.append(rate)
        else:
            all_without.append(rate)
        print(f"  {eval_dir} / {run}: {passed}/{total} ({rate:.0%})")

avg_with = sum(all_with)/len(all_with)
avg_without = sum(all_without)/len(all_without)
print(f"\nAverage WITH skill:    {avg_with:.0%}")
print(f"Average WITHOUT skill: {avg_without:.0%}")
print(f"Delta: +{avg_with - avg_without:.0%}")
