#!/usr/bin/env python3
"""Rename showcase carrier/concept titles to fluent course-like Chinese."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROUTE = ROOT / "src/data/interview-route.json"
NETWORK = ROOT / "src/data/author-network-content.json"
LEARNING = ROOT / "src/data/learning-content.json"

CARRIERS = {
    "card-carrier-job-contract": {
        "title": "跑通工具循环",
        "summary": "这一课先学会让模型会用工具：它提出要调用什么，由你的程序去跑，并能停下来。下面两节是「模型提议，程序执行」和「工具调用先校验」。你已经会的 Python、Git 和聊天，不再单独建一课。",
    },
    "card-carrier-job-tools": {
        "title": "看住它改文件",
        "summary": "这一课再学会：改文件之前先隔离、先批准，最后才按报错去找代码。三节分别是「在副本里改文件」「读写联网先批准」和「按报错找到文件」。必须在副本里用程序找代码。",
    },
    "card-carrier-job-evidence": {
        "title": "长对话怎么记",
        "summary": "循环一长，窗口会被重复记录占满。这一课只依赖前面留下的轨迹，不依赖检索结果。两节是「长记录只留要点」和「用到再打开技能」。两路齐了，再进入「用题目来验收」。",
    },
    "card-carrier-job-deliver": {
        "title": "用题目来验收",
        "summary": "把「看住它改文件」和「长对话怎么记」接到同一轮循环里，用固定题目留下一成一败。两节是「把零件接到一起」和「用同一套题再测」。",
    },
}

CONCEPTS = {
    "card-llm-application-concept-1": (
        "模型提议，程序执行",
        "属于「跑通工具循环」。\n\n学什么：一轮里看清提议、校验、回填、停止，而不是只发出一句聊天。\n\n边界：第一次只给只读工具；这一课不写文件、不讲沙箱。\n\n为什么：没有这一课，后面「看住它改文件」和「长对话怎么记」都接不上。\n\n必要前置：起点里的 Python、Git、聊天请求。起点不是一课。\n\n完成检验：指出哪一步由模型提出、哪一步由程序执行、观察从哪回填、超过 8 轮如何停。",
    ),
    "card-llm-application-concept-2": (
        "工具调用先校验",
        "属于「跑通工具循环」。\n\n学什么：工具名和参数必须能被程序看懂；缺字段、越界路径必须失败。\n\n边界：结构合法还不等于这次操作该发生；读、写、联网留给「读写联网先批准」。\n\n为什么：缺了它，后面分不清「调用不合法」和「沙箱拒绝」。\n\n必要前置：「模型提议，程序执行」（有一次真实工具调用来校验）。\n\n完成检验：合法调用执行；缺字段与指向工作区外的路径明确失败，不补默认值。",
    ),
    "card-llm-application-concept-3": (
        "在副本里改文件",
        "属于「看住它改文件」。\n\n学什么：工作目录限制在副本；逃出工作区的路径拒绝。\n\n边界：不讲容器内核；这一课不做检索策略，也不教批准分类。\n\n为什么：缺了它，「按报错找到文件」和后面的写入会直接落在主机上。\n\n必要前置：先学完「跑通工具循环」。这一课内部先隔离，再批准，最后才检索。\n\n完成检验：工作区内读取放行，`../` 与工作区外路径拒绝，并能从记录解释。",
    ),
    "card-llm-application-concept-4": (
        "读写联网先批准",
        "属于「看住它改文件」。\n\n学什么：只读可以自动；写入和联网必须申请；拒绝要写回下一轮，不能换一条命令暗改。\n\n边界：这一课不设计整页界面；请人看界面是请教里的审美。\n\n为什么：缺了它，作品无法解释「为什么这次写入没发生」。\n\n必要前置：同一课里的「在副本里改文件」。「按报错找到文件」还没开始。\n\n完成检验：只读自动、写入需申请、联网需申请各举一例，说明拒绝后观察如何回填。",
    ),
    "card-llm-application-concept-5": (
        "按报错找到文件",
        "属于「看住它改文件」，排在「在副本里改文件」和「读写联网先批准」之后。\n\n学什么：用失败测试名、报错和符号做精确匹配；搜到不等于看对了。\n\n边界：不做向量库；不把整仓塞进窗口；这一课不教「长记录只留要点」或「用到再打开技能」。\n\n为什么：缺了它，作品只能靠模型猜文件。\n\n必要前置：同一课里的隔离与批准。检索使用工作区限制和只读自动批准。\n\n完成检验：两个能用测试名定位的问题和一个名称对不上的问题，逐条说明命中是否含该看的代码。",
    ),
    "card-llm-application-concept-6": (
        "长记录只留要点",
        "属于「长对话怎么记」。\n\n学什么：留下目标、已改文件、失败测试和最近工具结果；重复探索做成摘要。\n\n边界：这一课不做长期记忆产品；失败原因不能压没；不教「用到再打开技能」。\n\n为什么：缺了它，长对话会丢掉「为什么写入被拒」。\n\n必要前置：「跑通工具循环」留下的轨迹。不需要检索结果，也不需要技能说明。\n\n完成检验：12 步压完仍能复述改了什么、为何失败。",
    ),
    "card-llm-application-concept-7": (
        "用到再打开技能",
        "属于「长对话怎么记」。\n\n学什么：跑测试、提交前检查各一份短说明；用到再放进窗口，用完再拿掉。\n\n边界：不是多 Agent，不是框架课；这一课不发明压缩算法。\n\n为什么：缺了它，作品会把全部规范一次塞进窗口，淹没当前问题。\n\n必要前置：「跑通工具循环」。最小练习不需要压缩产物。\n\n完成检验：定位到测试后只出现测试说明，准备提交时才出现检查说明。",
    ),
    "card-llm-application-concept-8": (
        "把零件接到一起",
        "属于「用题目来验收」。\n\n学什么：「按报错找到文件」「读写联网先批准」「长记录只留要点」和「用到再打开技能」为同一个失败测试服务；不另起项目，不引入第二个 Agent。\n\n边界：这一课不发明新的工具协议。\n\n为什么：缺了它，前面只是零件。\n\n必要前置：「看住它改文件」与「长对话怎么记」两路都齐。\n\n完成检验：覆盖只读定位、申请写入、工具失败；每种情况都能解释为何使用或不使用某类工具。",
    ),
    "card-llm-application-concept-9": (
        "用同一套题再测",
        "属于「用题目来验收」。\n\n学什么：固定 8–12 个问题，记录轨迹、补丁和测试；区分检索失败、改错文件和测试不稳。\n\n边界：不要求提交公开榜；评测证明能重复自己，不代替请人做上线前评估。\n\n为什么：缺了它，作品只是一次演示运气。\n\n必要前置：「把零件接到一起」（先有同一循环上的完整轨迹）。\n\n完成检验：同一组问题重现一成一败，能指出失败落在「跑通工具循环」、隔离、批准、取证还是「长对话怎么记」。",
    ),
}

PHRASE_SWAPS = [
    ("提议程序回填：模型提议，程序执行", "模型提议，程序执行"),
    ("工具参数契约：缺字段必须失败", "工具调用先校验"),
    ("沙箱工作隔离：副本内才能改", "在副本里改文件"),
    ("读写联网闸门：写入必须申请", "读写联网先批准"),
    ("失败测试取证：先用程序定位", "按报错找到文件"),
    ("轨迹摘要压缩：丢掉重复留原因", "长记录只留要点"),
    ("技能按需加载：用到再注入说明", "用到再打开技能"),
    ("同环能力汇合：零件接到同一循环", "把零件接到一起"),
    ("冻结评测复现：留下一成一败", "用同一套题再测"),
    ("提议程序回填", "模型提议程序执行"),
    ("工具参数契约", "工具调用先校验"),
    ("沙箱工作隔离", "在副本里改文件"),
    ("读写联网闸门", "读写联网先批准"),
    ("失败测试取证", "按报错找到文件"),
    ("轨迹摘要压缩", "长记录只留要点"),
    ("技能按需加载", "用到再打开技能"),
    ("同环能力汇合", "把零件接到一起"),
    ("冻结评测复现", "用同一套题再测"),
    ("循环工程", "跑通工具循环"),
    ("受控执行", "看住它改文件"),
    ("上下文工程", "长对话怎么记"),
    ("复现评测", "用题目来验收"),
]


def swap_phrases(value: str) -> str:
    for old, new in PHRASE_SWAPS:
        value = value.replace(old, new)
    return value


def update_route() -> None:
    data = json.loads(ROUTE.read_text())
    data["metadata"]["description"] = (
        "已能独立写 Python 并用 Git 看差异，调用过聊天接口，但还不会工具循环、沙箱和权限。"
        "每周六小时，做成能修真实 issue 的编码 Agent；不训练，不上多 Agent。"
        "起点只记录已掌握内容，不是一课；下一座圆台才开始收概念。"
        "四课分别是跑通工具循环、看住它改文件、长对话怎么记、用题目来验收，分别含："
        "模型提议，程序执行与工具调用先校验；在副本里改文件、读写联网先批准与按报错找到文件；"
        "长记录只留要点与用到再打开技能；把零件接到一起与用同一套题再测。"
        "时间只安排节奏，不承诺固定周期完成。"
    )
    cards = {card["id"]: card for card in data["data"]["cards"]}
    for card_id, payload in CARRIERS.items():
        cards[card_id]["title"] = payload["title"]
        cards[card_id]["summary"] = payload["summary"]
    for card_id, (title, body) in CONCEPTS.items():
        cards[card_id]["title"] = title
        cards[card_id]["summary"] = body
        cards[card_id]["body"] = body
    ROUTE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def update_network() -> None:
    text = NETWORK.read_text()
    NETWORK.write_text(swap_phrases(text))


def update_learning() -> None:
    data = json.loads(LEARNING.read_text())
    data["title"] = "模型提议，程序执行"
    raw = json.dumps(data, ensure_ascii=False, indent=2)
    LEARNING.write_text(swap_phrases(raw) + "\n")


if __name__ == "__main__":
    update_route()
    update_network()
    update_learning()
    print("renamed course titles in route, network, and learning JSON")
