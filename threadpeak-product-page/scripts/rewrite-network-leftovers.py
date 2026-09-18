#!/usr/bin/env python3
"""Replace leftover document-assistant / RAG titles still visible on the network."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NETWORK = ROOT / "src/data/author-network-content.json"

FEATURED = {
    "author-ev-4b4af40127f923e8fd6b5fe03a07bcbb",
    "author-ev-b91f89c7433b7ce4e9e08e0902973b01",
    "author-ev-fcaa79510d00451c65dfea18cd6ba683",
    "author-ev-b3365850817dd1343f5efe3799e451dd",
    "author-ev-acd97c14ea01f980fe429e0ff47809cd",
    "author-ev-cbffcc49059093c82647861f85760af1",
    "author-ev-bf7ab7d8b67de2f723c8835496ef6ebb",
}

KEEP_NAMES = {
    "林启衡", "苏晚青", "韩牧之", "乔北辰", "沈知夏", "裴临川",
    "顾衡川", "叶知秋", "程远山", "方既白",
    "闻栖迟", "江晚舟", "陆承野", "许清和", "莫听潮", "晏北林",
    "纪南枝", "霍清川", "唐既望", "阮青桐", "岑望远", "谢临风",
    "卞知微", "卫承安", "尹拾光", "聂晚晴", "俞照野", "夏听澜",
    "齐北渡", "钟衔月", "柳知还", "范清野", "金拾穗", "宋临川",
}

DEMO_NAMES = [
    "闻栖迟", "江晚舟", "陆承野", "许清和", "莫听潮", "晏北林",
    "纪南枝", "霍清川", "唐既望", "阮青桐", "岑望远", "谢临风",
    "卞知微", "卫承安", "尹拾光", "聂晚晴", "俞照野", "夏听澜",
    "齐北渡", "钟衔月", "柳知还", "范清野", "金拾穗", "宋临川",
]

CARRIER_TITLES = {
    "carrier-job-contract": [
        "先看住一轮可观察的循环 - 知乎",
        "停止条件要写在宿主里 - 知乎",
        "回填失败，下一轮只会假装记得 - 知乎",
        "第一次循环不要挂写入工具 - 知乎",
        "参数缺了就该失败，不要补默认值 - 知乎",
        "工具名是契约，不是对话里的暗示 - 知乎",
    ],
    "carrier-job-tools": [
        "副本里能改，主机上不能碰 - 知乎",
        "越界路径先拒绝，再谈检索 - 知乎",
        "只读可以自动，写入必须申请 - 知乎",
        "拒绝也要回填，不能换命令暗改 - 知乎",
        "先用测试名定位，不要先做向量库 - 知乎",
        "命中不是依据，还要打开文件核对 - 知乎",
    ],
    "carrier-job-evidence": [
        "丢掉重复的 ls，不要丢掉拒绝原因 - 知乎",
        "压缩按阶段切换，不要一刀切摘要 - 知乎",
        "Skills 用到再注入，用完就移出 - 知乎",
        "窗口被规范塞满，当前 issue 会失踪 - 知乎",
        "十二步之后还要能复述为何失败 - 知乎",
        "按需加载说明，不是再请一个 Agent - 知乎",
    ],
    "carrier-job-deliver": [
        "零件会了，还不等于能修一个 issue - 知乎",
        "检索和权限要接到同一个循环 - 知乎",
        "冻结一组 issue，才能讲清成败落点 - 知乎",
        "一次幸运修复证明不了你看住了循环 - 知乎",
        "评测证明能重复自己，不代替上线前评估 - 知乎",
        "留下一成一败，再拿去给人看 - 知乎",
    ],
}

LEFTOVER = re.compile(
    r"RAG|向量|Embedding|嵌入|PDF|知识库|分块|文档助手|问答助手|"
    r"核心参数|JSON 模式|结构化输出|知识问答|意图识别|客服|"
    r"第\s*\d+\s*课|万字长文|一文搞懂|切分策略|归因怎么做|"
    r"设计哲学|会话历史|多轮会话|记忆机制|读取 PDF|"
    r"请返回 JSON|约束解码|WorkBuddy|阿里面试|容错与重试机制",
    re.I,
)

STUB = "演示课文已按编码 Agent 主线改写"


def leftover_title(title: str) -> bool:
    return bool(LEFTOVER.search(title))


def rewrite_network() -> None:
    data = json.loads(NETWORK.read_text())
    name_map: dict[str, str] = {}
    name_i = 0
    title_i: dict[str, int] = {}

    for author in data["network"]["authors"]:
        if author["id"] in FEATURED:
            continue
        if author["name"] not in KEEP_NAMES:
            if author["name"] not in name_map:
                name_map[author["name"]] = DEMO_NAMES[name_i % len(DEMO_NAMES)]
                name_i += 1
            author["name"] = name_map[author["name"]]
        for evidence in author["evidence"]:
            evidence["authorName"] = author["name"]
            carrier = ""
            for use in evidence.get("uses") or []:
                carrier = use.get("carrierId") or carrier
            pool = CARRIER_TITLES.get(carrier, CARRIER_TITLES["carrier-job-contract"])
            if leftover_title(evidence.get("title", "")):
                idx = title_i.get(carrier, 0)
                title_i[carrier] = idx + 1
                evidence["title"] = pool[idx % len(pool)]
            short = evidence["title"].replace(" - 知乎", "")
            if leftover_title(evidence.get("summary", "")) or "问答助手" in evidence.get("summary", ""):
                evidence["summary"] = f"{short}。公开写法，用来对照载体上的概念，不是做成作品的依据。"
            for use in evidence.get("uses") or []:
                titles = use.get("nodeTitles")
                if isinstance(titles, dict):
                    for key, title in list(titles.items()):
                        if leftover_title(title):
                            titles[key] = evidence["title"]

    note = (
        "按编码 Agent 主线改写：复用 Python 与 Git，从循环、契约或对应载体概念往下学。"
        "检索排在沙箱和闸门之后，不做向量库。"
    )
    details = data.get("details")
    if isinstance(details, dict):
        for item in details.values():
            if not isinstance(item, dict):
                continue
            for card in item.get("cards") or []:
                if not isinstance(card, dict):
                    continue
                preview = card.get("preview", "")
                title = card.get("title", "")
                if leftover_title(title) or leftover_title(preview) or STUB in preview or "HTTP 接口" in preview or "产品文档" in preview:
                    if leftover_title(title):
                        card["title"] = "编码 Agent 主线笔记"
                    card["preview"] = f"{card.get('title', '编码 Agent 主线笔记')}。{note}"

    NETWORK.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"renamed {len(name_map)} authors; rewritten leftover network titles")


if __name__ == "__main__":
    rewrite_network()
