#!/usr/bin/env python3
"""Rewrite product-page route cards and leftover document-assistant strings."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROUTE = ROOT / "src/data/interview-route.json"
NETWORK = ROOT / "src/data/author-network-content.json"

CARRIERS = {
    "card-carrier-job-contract": {
        "eyebrow": "学习载体",
        "title": "跑通工具循环",
        "summary": "本载体含两个概念：循环、契约。先走完提议 → 校验 → 回填 → 停止，再分头学安全和窗口。起点里已经会的 Python、Git 和聊天调用不建载体。",
        "tags": ["学习方向", "阶段载体"],
    },
    "card-carrier-job-tools": {
        "eyebrow": "学习载体",
        "title": "看住它改文件",
        "summary": "本载体含三个概念：沙箱、闸门、检索。隔离和批准先齐，检索排在最后，必须在副本里用程序找代码。",
        "tags": ["学习方向", "阶段载体"],
    },
    "card-carrier-job-evidence": {
        "eyebrow": "学习载体",
        "title": "长对话怎么记",
        "summary": "本载体含两个概念：压缩、Skills。只依赖第一层循环留下的轨迹，不依赖检索产物；两路齐了再交付。",
        "tags": ["学习方向", "阶段载体"],
    },
    "card-carrier-job-deliver": {
        "eyebrow": "学习载体",
        "title": "用题目来验收",
        "summary": "本载体含两个概念：汇合、评测。把取证和窗口接到同一个循环里，用固定 issue 留下一成一败。",
        "tags": ["学习方向", "阶段载体"],
    },
    "card-start": {
        "eyebrow": "路线起点 · 不是载体",
        "title": "从这里出发",
        "summary": "已掌握：能独立写 Python，并用 Git 看差异；调用过聊天接口。还不会工具循环、沙箱和权限。下一座圆台才是第一个载体。目标是求职用的编码 Agent；每周六小时；不训练，不上多 Agent。",
        "tags": ["开始"],
    },
    "card-goal": {
        "eyebrow": "学习目标 · 不是载体",
        "title": "能解释、能停下来的编码 Agent",
        "summary": "在沙箱里检索代码、受控写入并修真实 issue；自己能解释循环、权限和一次失败落在哪一层。允许使用现成模型和现成测试，不要求实现模型内部。",
        "tags": ["路线终点"],
    },
}

CONCEPTS = {
    "card-llm-application-concept-1": (
        "Agent 循环：模型提议，程序执行",
        "属于载体「可调用的循环」。\n\n学什么：一轮可观察的循环，含回填与停止，不只是发出第一句聊天。\n\n边界：第一次只给只读工具；不在本节点写文件、不讲沙箱实现。\n\n为什么：没有循环，沙箱、闸门、检索都没有可接的执行位置。\n\n必要前置：起点里的 Python、Git、聊天请求。起点不是载体。\n\n完成检验：指出哪一步由模型提出、哪一步由程序执行、观察从哪回填、超过 8 轮如何停。",
    ),
    "card-llm-application-concept-2": (
        "工具契约：参数必须可校验",
        "属于载体「可调用的循环」。\n\n学什么：工具名和参数是程序契约；缺字段、越界路径必须失败。\n\n边界：结构合法不等于操作该发生；读/写/联网留给闸门。\n\n为什么：缺了它，后面分不清「调用不合法」和「沙箱拒绝」。\n\n必要前置：概念 1（有一次真实工具调用来校验）。\n\n完成检验：合法调用执行；缺字段与指向工作区外的路径明确失败，不补默认值。",
    ),
    "card-llm-application-concept-3": (
        "沙箱：改仓库，但不能改主机",
        "属于载体「可安全地取证」。\n\n学什么：工作目录限制在副本；逃出工作区的路径拒绝。\n\n边界：不讲容器内核；不在本节点做检索策略，也不教批准分类。\n\n为什么：缺了它，检索的 grep 和交付时的写入会直接落在主机。\n\n必要前置：第一层整层。本载体内部先学隔离，再学批准，最后才检索。\n\n完成检验：工作区内读取放行，`../` 与工作区外路径拒绝，并能从记录解释。",
    ),
    "card-llm-application-concept-4": (
        "权限闸门：读、写、联网分开批准",
        "属于载体「可安全地取证」。\n\n学什么：只读可自动；写入和联网必须申请；拒绝要回填，不能换一条命令暗改。\n\n边界：不在本节点设计整页 UI；请人看界面是请教里的审美。\n\n为什么：缺了它，交付无法解释「为什么这次写入没发生」。\n\n必要前置：本载体的沙箱概念。检索还没开始。\n\n完成检验：只读自动、写入需申请、联网需申请各举一例，说明拒绝后观察如何回填。",
    ),
    "card-llm-application-concept-5": (
        "确定性检索：先用程序找代码",
        "属于载体「可安全地取证」，排在沙箱和闸门之后。\n\n学什么：用失败测试名、报错和符号做精确匹配；命中不是依据。\n\n边界：不做向量库；不把整仓塞进窗口；不在本节点教压缩或 Skills。\n\n为什么：缺了它，交付只能靠模型猜文件。\n\n必要前置：同一载体里的沙箱与闸门。检索使用工作区限制和只读自动批准。\n\n完成检验：两个能用测试名定位的问题和一个名称对不上的问题，逐条说明命中是否含该看的代码。",
    ),
    "card-llm-application-concept-6": (
        "上下文工程：压缩轨迹，不堆全文",
        "属于载体「能保住窗口」。\n\n学什么：保留目标、已改文件、失败测试和最近工具结果；重复探索做成摘要。\n\n边界：不在本节点做长期记忆产品；失败原因不能压没；不教 Skills。\n\n为什么：缺了它，交付的长轨迹会丢掉「为什么写入被拒」。\n\n必要前置：第一层循环轨迹。不需要检索产物，也不需要 Skills。\n\n完成检验：12 步压完仍能复述改了什么、为何失败。",
    ),
    "card-llm-application-concept-7": (
        "Skills 渐进披露：需要时才加载说明",
        "属于载体「能保住窗口」。\n\n学什么：跑测试、提交前检查各一份短说明；用到再注入，用完移出。\n\n边界：不是多 Agent，不是框架课；不在本节点发明压缩算法。\n\n为什么：缺了它，交付会把全部规范一次塞进窗口，淹没当前 issue。\n\n必要前置：第一层循环。最小练习不需要压缩产物。\n\n完成检验：定位到测试后只出现测试说明，准备提交时才出现检查说明。",
    ),
    "card-llm-application-concept-8": (
        "汇合：接到同一个循环里",
        "属于载体「能交付并验证」。\n\n学什么：检索、权限、压缩和 Skills 为同一个失败测试服务；不另起项目，不引入第二个 Agent。\n\n边界：不在本节点发明新工具协议。\n\n为什么：缺了它，前面只是零件。\n\n必要前置：取证载体与窗口载体两路都齐。\n\n完成检验：覆盖只读定位、申请写入、工具失败；每种情况都能解释为何使用或不使用某类工具。",
    ),
    "card-llm-application-concept-9": (
        "可复现评测：用固定 issue 讲清成败",
        "属于载体「能交付并验证」。\n\n学什么：冻结 8–12 个 issue，记录轨迹、补丁和测试；区分检索失败、错误编辑和测试不稳。\n\n边界：不要求提交公开榜；评测证明能重复自己，不代替请人做上线前评估。\n\n为什么：缺了它，作品只是一次演示运气。\n\n必要前置：概念 8（先有同一循环上的完整轨迹）。\n\n完成检验：同一组 issue 重现一成一败，能指出失败落在循环、隔离、批准、检索还是窗口。",
    ),
}

TOPIC_BY_ID = {
    "llm-application-concept-1": "模型提议，程序执行",
    "llm-application-concept-2": "工具调用先校验",
    "llm-application-concept-3": "在副本里改文件",
    "llm-application-concept-4": "读写联网先批准",
    "llm-application-concept-5": "按报错找到文件",
    "llm-application-concept-6": "长记录只留要点",
    "llm-application-concept-7": "用到再打开技能",
    "llm-application-concept-8": "把零件接到一起",
    "llm-application-concept-9": "用同一套题再测",
}

CARRIER_BY_ID = {
    "carrier-job-contract": "跑通工具循环",
    "carrier-job-tools": "看住它改文件",
    "carrier-job-evidence": "长对话怎么记",
    "carrier-job-deliver": "用题目来验收",
}

TITLE_SWAPS = {
    "消息角色：接通第一次模型对话": "Agent 循环：模型提议，程序执行",
    "先接通同一个文档助手": "先跑通同一个 Agent 循环",
    "消息角色告诉模型：谁在说什么": "下一轮要带上需要的观察",
    "让文档助手返回一个能检查的对象": "工具调用必须先被程序看懂",
    "LLM 应用开发基础": "可调用的循环",
    "Agent 循环与受控工具": "可安全地取证",
    "检索增强生成 · RAG": "能保住窗口",
    "Agent 评测与工程交付": "能交付并验证",
    "能解释、能排错的文档助手": "能解释、能停下来的编码 Agent",
}

AUTHORS = {
    "author-ev-4b4af40127f923e8fd6b5fe03a07bcbb": ("林启衡", "先写一个能停下来的循环 - 知乎"),
    "author-ev-b91f89c7433b7ce4e9e08e0902973b01": ("苏晚青", "工具调用是程序契约，不是对话技巧 - 知乎"),
    "author-ev-fcaa79510d00451c65dfea18cd6ba683": ("韩牧之", "失败轨迹比成功回复更值得留下来 - 知乎"),
    "author-ev-b3365850817dd1343f5efe3799e451dd": ("乔北辰", "第一次循环只用只读工具 - 知乎"),
    "author-ev-acd97c14ea01f980fe429e0ff47809cd": ("林启衡", "请求成功，不等于失败观察已经进去 - 知乎"),
    "author-ev-cbffcc49059093c82647861f85760af1": ("苏晚青", "压缩要按任务阶段切换，不要一刀切 - 知乎"),
    "author-ev-bf7ab7d8b67de2f723c8835496ef6ebb": ("韩牧之", "给别人看作品时，留下一次失败更有用 - 知乎"),
}

NODE_TITLES = {
    "answer-39e1d645-cb2c-4c72-81ce-df22f830ab39-0": "先跑通同一个 Agent 循环",
    "answer-39e1d645-cb2c-4c72-81ce-df22f830ab39-1": "下一轮要带上需要的观察",
    "answer-09f30072-85a3-4585-9ecf-c1aa1d631490-0": "工具调用必须先被程序看懂",
    "author-615fbaa9-7356-4cd4-8a58-af2cb2dee6c2-0": "请求成功，不等于失败观察已经进去 - 知乎",
    "author-615fbaa9-7356-4cd4-8a58-af2cb2dee6c2-1": "压缩要按任务阶段切换，不要一刀切 - 知乎",
    "author-615fbaa9-7356-4cd4-8a58-af2cb2dee6c2-2": "给别人看作品时，留下一次失败更有用 - 知乎",
    "4b4af40127f923e8fd6b5fe03a07bcbb": "先写一个能停下来的循环 - 知乎",
    "b91f89c7433b7ce4e9e08e0902973b01": "工具调用是程序契约，不是对话技巧 - 知乎",
    "fcaa79510d00451c65dfea18cd6ba683": "失败轨迹比成功回复更值得留下来 - 知乎",
    "b3365850817dd1343f5efe3799e451dd": "第一次循环只用只读工具 - 知乎",
}

ASK_QUESTION = "循环超过八步之后，失败的工具结果该原文回填，还是先压成摘要？"

PHRASE_SWAPS = [
    ("文档助手", "编码 Agent"),
    ("产品手册", "仓库副本"),
    ("产品服务手册", "失败测试"),
    ("接通第一次模型对话", "先跑通同一个 Agent 循环"),
    ("先接通同一个", "先跑通同一个"),
    ("lookup_manual", "list_dir"),
    ("search_manual", "search_repo"),
    ("型号 A", "test_auth"),
    ("型号 B", "test_login"),
    ("保修期限", "失败测试"),
    ("保修", "测试"),
    ("手册", "仓库"),
]


def rewrite_text(value: str) -> str:
    for old, new in TITLE_SWAPS.items():
        value = value.replace(old, new)
    for old, new in PHRASE_SWAPS:
        value = value.replace(old, new)
    return value


def rewrite_obj(node):
    if isinstance(node, dict):
        topic_id = node.get("topicId")
        carrier_id = node.get("carrierId")
        if topic_id in TOPIC_BY_ID and "topic" in node:
            node["topic"] = TOPIC_BY_ID[topic_id]
        if carrier_id in CARRIER_BY_ID and "carrier" in node:
            node["carrier"] = CARRIER_BY_ID[carrier_id]
        if node.get("id") in TOPIC_BY_ID and node.get("title"):
            node["title"] = TOPIC_BY_ID[node["id"]]
        titles = node.get("nodeTitles")
        if isinstance(titles, dict):
            for key, title in list(titles.items()):
                titles[key] = NODE_TITLES.get(key, rewrite_text(title))
        if node.get("questionKind") == "follow_up" and "question" in node:
            node["question"] = ASK_QUESTION
        for key, value in list(node.items()):
            if key in {"topic", "carrier"} and (topic_id in TOPIC_BY_ID or carrier_id in CARRIER_BY_ID):
                continue
            if key == "nodeTitles":
                continue
            node[key] = rewrite_obj(value)
        return node
    if isinstance(node, list):
        return [rewrite_obj(item) for item in node]
    if isinstance(node, str):
        return rewrite_text(node)
    return node


def update_route() -> None:
    data = json.loads(ROUTE.read_text())
    data["metadata"]["title"] = "编码 Agent 求职路线"
    data["metadata"]["description"] = (
        "已能独立写 Python 并用 Git 看差异，调用过聊天接口，但还不会工具循环、沙箱和权限。"
        "每周六小时，做成能修真实 issue 的编码 Agent；不训练，不上多 Agent。"
        "起点只记录已掌握内容，不是载体；下一座圆台才开始收概念。"
        "四个载体分别含：循环与契约；沙箱、闸门与检索；压缩与 Skills；汇合与评测。"
        "时间只安排节奏，不承诺固定周期完成。"
    )
    for concept in data["structure"]["concepts"]:
        if concept["id"] == "llm-application-concept-5":
            concept["subjectId"] = "carrier-job-tools"
    cards = {card["id"]: card for card in data["data"]["cards"]}
    for card_id, payload in CARRIERS.items():
        cards[card_id].update(payload)
    for card_id, (title, body) in CONCEPTS.items():
        cards[card_id]["eyebrow"] = "概念"
        cards[card_id]["title"] = title
        cards[card_id]["summary"] = body
        cards[card_id]["body"] = body
        cards[card_id]["tags"] = ["目标所需"]
    ROUTE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def update_network() -> None:
    data = json.loads(NETWORK.read_text())
    data["provenance"]["scope"] = "产品展示，已保存的编码 Agent 路线示例与问博主检索快照"
    for author in data["network"]["authors"]:
        mapped = AUTHORS.get(author["id"])
        if mapped:
            name, title = mapped
            author["name"] = name
            for evidence in author["evidence"]:
                evidence["authorName"] = name
                evidence["title"] = title
                if author["id"].startswith("author-ev-acd97") or author["id"].startswith("author-ev-cbff") or author["id"].startswith("author-ev-bf7a"):
                    evidence["summary"] = title.replace(" - 知乎", "") + "。公开写法，不是对某个仓库的评审。"
    data = rewrite_obj(data)
    NETWORK.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    update_route()
    update_network()
    print("updated interview-route.json and author-network-content.json")
