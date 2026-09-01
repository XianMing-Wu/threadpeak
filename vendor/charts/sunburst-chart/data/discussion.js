/**
 * Sample claim tree. Each node is:
 *   { id, text, stance: 'thesis' | 'pro' | 'con', impact: 0-4, children: [] }
 *
 * Swap `discussion` or pass another tree into <Sunburst data={...} />.
 */

const PRO_CLAIMS = [
  'Once carried out, an execution cannot be undone if the conviction is later shown to be wrong.',
  'The right to life is the premise of every other civil protection a state claims to honour.',
  'A society that refuses to kill the guilty is more consistent about refusing to kill the innocent.',
  'Permanent imprisonment already removes a person from public life without making the state an executioner.',
  'Wrongful convictions are not rare enough to treat death as an acceptable residual risk.',
  'Appeals in capital cases stretch for decades because the penalty leaves no room for a later correction.',
  'International human-rights law treats execution as a punishment a modern state should not keep.',
  'Rehabilitation becomes impossible the moment the sentence is carried out.',
  'Families of the accused are punished by a ceremony of killing they cannot reverse.',
  'Juries asked to choose death are asked to perform a moral task they are not equipped to bear.',
  'Public mourning after an execution rarely looks like justice; it looks like another death.',
  'A state that kills in our name trains citizens to see some lives as disposable.',
  'Mercy is a civic skill: using death as policy lets that skill atrophy.',
  'Most peer democracies have already abandoned this penalty without collapsing into chaos.',
  'Capital trials consume extraordinary public money that could staff investigation and prevention.',
  'Poor defendants receive weaker capital defense, so the penalty tracks wealth more than guilt.',
  'Racial disparity in death sentences repeats older patterns of unequal protection.',
  'Life without parole already answers the demand that a dangerous person never return.',
  'Witnesses to lethal injection describe a medical theatre that does not look like justice.',
  'If deterrence were reliable, jurisdictions that execute would show a clear, stable drop in homicide.',
]

const CON_CLAIMS = [
  'Some crimes are so grave that only a matching penalty expresses the seriousness of the harm.',
  'A credible threat of death can pressure guilty defendants to confess and spare victims a trial.',
  'Keeping high-risk offenders alive for decades still leaves staff and other prisoners exposed.',
  'Victims’ families often describe closure only after a sentence they regard as final.',
  'A life term can be shortened by later politics; death is the one sentence that cannot be bargained away.',
  'If prison already uses lethal force to stop a riot, execution is not a different moral universe.',
  'Some offenders reoffend after release; death removes that residual public risk entirely.',
  'Public opinion in several regions still treats execution as a legitimate tool of justice.',
  'A penalty reserved for the worst cases can be narrowed without being abolished.',
  'Investigators may pursue capital crimes more thoroughly because the stakes are higher.',
  'Moral consistency does not require the state to refuse all killing, including just war.',
  'An execution can be a cheaper long-run alternative to housing someone for fifty years.',
  'Deterrence need not be perfect to be worth keeping at the extreme tail of violence.',
  'Abolition would be read by some offenders as a signal that the worst harm has a ceiling they can live with.',
  'Jury nullification already lets communities refuse death; the option can remain for the rest.',
  'Forensic methods keep improving, so the historical innocence argument grows weaker over time.',
  'A democratic majority should be allowed to keep a penalty it still endorses.',
  'Natural life in a supermax cell can be a slower cruelty than a brief, lawful execution.',
  'International pressure is not a substitute for a local theory of just punishment.',
  'If the method is the problem, the method can change; that is not an argument for abolition.',
]

function opposite(stance) {
  return stance === 'pro' ? 'con' : 'pro'
}

function textFor(stance, salt) {
  const pool = stance === 'pro' ? PRO_CLAIMS : CON_CLAIMS
  return pool[Math.abs(salt) % pool.length]
}

function mixStance(parentStance, salt) {
  return Math.abs(salt) % 10 < 5 ? opposite(parentStance) : parentStance
}

function splitLeaves(total, parts, salt) {
  const n = Math.max(1, Math.min(parts, total))
  const shares = Array.from({ length: n }, () => 1)
  let leftover = total - n
  let i = 0
  while (leftover > 0) {
    shares[(i + salt) % n] += 1
    leftover -= 1
    i += 1
  }
  return shares
}

let nextId = 0

function claim(stance, impact, text, children = []) {
  nextId += 1
  return {
    id: `${stance}-${nextId}`,
    stance,
    impact,
    text,
    children,
  }
}

function branch(stance, impact, text, leaves, depth, salt, maxDepth = 8) {
  if (leaves <= 1 || depth >= maxDepth) {
    return claim(stance, impact, text)
  }

  const childCount = depth < 5 ? 2 : Math.max(2, Math.min(leaves, 2 + (Math.abs(salt) % 3)))
  const shares = splitLeaves(leaves, childCount, salt)

  return claim(
    stance,
    impact,
    text,
    shares.map((share, index) => {
      const childStance = mixStance(stance, salt + index * 7)
      const childImpact = (impact + index + salt + 2) % 5
      return branch(
        childStance,
        childImpact,
        textFor(childStance, salt + index * 11 + depth * 3),
        share,
        depth + 1,
        salt * 13 + index * 17 + depth,
        maxDepth,
      )
    }),
  )
}

export function findClaim(node, id) {
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    const match = findClaim(child, id)
    if (match) return match
  }
  return null
}

export const discussion = {
  id: 'thesis',
  stance: 'thesis',
  impact: 2,
  text: 'Death penalty should be abolished.',
  children: [
    branch(
      'pro',
      3,
      'Unlike any other criminal penalty, an execution ends the possibility of reversing a mistake.',
      36,
      1,
      4,
    ),
    branch(
      'pro',
      2,
      'Abolition is the only policy consistent with a non-negotiable right to life.',
      18,
      1,
      9,
    ),
    branch(
      'pro',
      2,
      'Permanent exclusion from society can be achieved through imprisonment without turning the state into a killer.',
      14,
      1,
      15,
    ),
    branch(
      'pro',
      4,
      'Capital systems reliably amplify poverty, race, and geography instead of tracking moral desert.',
      11,
      1,
      21,
    ),
    branch(
      'con',
      1,
      'The possibility of a death sentence can secure guilty pleas and spare victims a second ordeal.',
      9,
      1,
      27,
    ),
    branch(
      'con',
      2,
      'Some crimes are so exceptional that only death names the wrong in a way a population still recognizes.',
      16,
      1,
      33,
    ),
    branch(
      'con',
      2,
      'If the goal is public safety, execution removes residual risk that even a life term cannot erase.',
      20,
      1,
      41,
    ),
    branch(
      'con',
      3,
      'Abolition is a moral fashion exported by elites, not a requirement of a working justice system.',
      8,
      1,
      48,
    ),
  ],
}
