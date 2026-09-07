import type { SubjectYearSpec } from "./types";

export const historyYear5: SubjectYearSpec = {
  subject: { slug: "history", title: "History" },
  programme: {
    sequenceSlug: "history-primary",
    yearGroup: 5,
    keyStage: "ks2",
    phase: "primary",
    title: "History — Year 5",
  },
  units: [
    {
      slug: "the-anglo-saxons-and-vikings",
      title: "The Anglo-Saxons and Vikings",
      description:
        "Pupils learn about the Anglo-Saxon settlement of Britain, daily life and beliefs in Anglo-Saxon England, and the Viking raids and invasions that followed.",
      whyThisWhyNow:
        "This unit gives pupils a chronological understanding of a formative period in British history after the Romans left, showing how invasion and settlement shaped early England.",
      priorKnowledge: [
        "Pupils know that the Romans invaded and then left Britain.",
        "Pupils understand that Britain has been settled by different peoples throughout its history.",
        "Pupils can place events on a simple timeline in chronological order.",
      ],
      nationalCurriculum: [
        "Britain's settlement by Anglo-Saxons and Scots.",
        "The Viking and Anglo-Saxon struggle for the Kingdom of England to the time of Edward the Confessor.",
      ],
      lessons: [
        {
          slug: "anglo-saxon-settlement-of-britain",
          title: "Anglo-Saxon settlement of Britain",
          pupilLessonOutcome: "I can explain when and why the Anglo-Saxons settled in Britain.",
          keyLearningPoints: [
            "The Anglo-Saxons began arriving in Britain from around AD 410, after the Romans left.",
            "The Anglo-Saxons came from northern Europe, from areas that are now Germany, Denmark and the Netherlands.",
            "The Anglo-Saxons settled across Britain and gradually divided the land into several separate kingdoms, such as Wessex, Mercia and Northumbria.",
            "'Anglo-Saxon' describes several different groups, including the Angles, Saxons and Jutes, who together shaped the culture, language and place names of England.",
          ],
          keywords: [
            { keyword: "settle", description: "To arrive in a new place and set up a permanent home there." },
            { keyword: "kingdom", description: "An area of land ruled by a king or queen." },
            { keyword: "migrate", description: "To move from one place to live in another." },
          ],
          misconceptions: [
            { misconception: "Pupils think 'Anglo-Saxon' is one single tribe or nationality, rather than several related groups who settled in Britain over time.", response: "Clarify that 'Anglo-Saxon' is a name historians use for several related groups, including the Angles, Saxons and Jutes, who came from different parts of northern Europe and gradually merged their cultures in Britain." },
            { misconception: "Pupils think Britain was a single, unified country under one Anglo-Saxon king from the very start of the settlement.", response: "Explain that Anglo-Saxon Britain was originally divided into several separate kingdoms, each with its own king, and it took hundreds of years before England began to unite under a single ruler." },
          ],
          teacherTips: [
            "Use a simple map showing northern Europe and Britain to help pupils visualise the sea journey the Anglo-Saxons made, and to explain why they settled mainly in the east and south of Britain first.",
            "Introduce the word 'kingdom' early and revisit it throughout the unit, since understanding that Anglo-Saxon Britain was divided into several kingdoms is key to later lessons on Viking invasion.",
          ],
          transcript:
            "Hello! Today we're travelling back over 1,600 years, to find out about the Anglo-Saxons and why they settled in Britain.\n\nAfter the Romans left Britain, around the year AD 410, groups of people from northern Europe began crossing the sea and settling here. We call these people the Anglo-Saxons. But 'Anglo-Saxon' isn't really the name of one single tribe. It's a name historians use to describe several different groups who came over, including the Angles, the Saxons, and the Jutes, from areas that are now part of Germany, Denmark and the Netherlands.\n\nWhy did they come? Historians think there were several reasons. Farmland in their homelands may have been in short supply, or damaged by flooding. Some may have come looking for better land to farm, others may have come as fighters, hired to help defend Britain, who then decided to stay and settle instead.\n\nOnce they arrived, the Anglo-Saxons didn't create one single united country straight away. Instead, they settled in different areas and gradually formed several separate kingdoms, each with its own king. Some of the most powerful kingdoms were called Wessex, Mercia and Northumbria. These kingdoms sometimes worked together, and sometimes fought each other, for hundreds of years.\n\nThe Anglo-Saxons left a huge mark on England that we can still see today. Many English place names come from Anglo-Saxon words, for example, place names ending in '-ham' or '-ton' often meant 'farm' or 'settlement'. Even the word 'England' comes from 'Angle-land', named after the Angles.\n\nA common mistake is thinking the Anglo-Saxons were one single tribe or nationality. Really, they were several related groups who gradually blended together over time in Britain. Another mistake is picturing Anglo-Saxon Britain as one unified country from the beginning, when actually it was made up of separate, often rival, kingdoms for hundreds of years.\n\nNow you'll look at a map and timeline to see where and when the Anglo-Saxons settled.",
          starterQuiz: [
            { kind: "mc", question: "Which ancient empire ruled Britain before the Anglo-Saxons arrived?", correct: ["The Romans"], distractors: ["The Vikings", "The Greeks", "The Normans"] },
            { kind: "mc", question: "What does it mean to 'settle' somewhere?", correct: ["To arrive in a new place and set up a permanent home"], distractors: ["To visit somewhere briefly", "To conquer a country by force only", "To trade with another country"] },
            { kind: "short", question: "Approximately what year did the Romans leave Britain?", answers: ["AD 410", "410"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "Where did the Anglo-Saxons originally come from?", correct: ["Northern Europe (areas now Germany, Denmark and the Netherlands)"], distractors: ["Southern Europe", "North Africa", "Scandinavia only"] },
            { kind: "mc", question: "Which of these was an Anglo-Saxon kingdom?", correct: ["Mercia"], distractors: ["Normandy", "Gaul", "Rome"] },
            { kind: "short", question: "Name one of the groups that made up the Anglo-Saxons.", answers: ["Angles", "Saxons", "Jutes"] },
            { kind: "match", question: "Match each term to its meaning.", pairs: [["settle", "to arrive somewhere and set up a permanent home"], ["kingdom", "an area of land ruled by a king or queen"], ["migrate", "to move from one place to live in another"]] },
            { kind: "order", question: "Order these events chronologically.", items: ["Romans leave Britain", "Anglo-Saxons begin settling in Britain", "Anglo-Saxon kingdoms such as Wessex and Mercia form"] },
          ],
          worksheet: [
            { text: "Name one Anglo-Saxon kingdom.", type: "short", answer: "Wessex, Mercia, or Northumbria" },
            { text: "Explain why 'Anglo-Saxon' is not the name of just one tribe.", type: "extended", answer: "A good answer explains that 'Anglo-Saxon' describes several related groups, including the Angles, Saxons and Jutes, who came from different parts of northern Europe and gradually blended together in Britain." },
            { text: "Give one possible reason the Anglo-Saxons came to Britain.", type: "short", answer: "looking for better farmland, or came as fighters who decided to stay" },
            { text: "Explain why it is inaccurate to describe Anglo-Saxon Britain as 'one united country' in the years after the Romans left.", type: "extended", answer: "A good answer explains that Anglo-Saxon Britain was divided into several separate kingdoms, such as Wessex, Mercia and Northumbria, each with its own king, and it took hundreds of years before England began to unite under one ruler." },
          ],
        },
        {
          slug: "anglo-saxon-daily-life-and-beliefs",
          title: "Anglo-Saxon daily life and beliefs",
          pupilLessonOutcome: "I can describe what daily life was like for Anglo-Saxon people, including their beliefs.",
          keyLearningPoints: [
            "Most Anglo-Saxons lived in small farming villages, in wooden houses with thatched roofs, and grew crops and kept animals to survive.",
            "Anglo-Saxon society had clear roles: a king ruled each kingdom, supported by nobles called thegns, while most people were farmers, and some were enslaved.",
            "Early Anglo-Saxons were pagans who worshipped several gods, including Woden and Thunor, before gradually converting to Christianity from the late 6th century onwards.",
            "Anglo-Saxon craftspeople were highly skilled, especially at metalwork, as shown by discoveries such as the Sutton Hoo ship burial.",
          ],
          keywords: [
            { keyword: "pagan", description: "Someone who worships several gods or nature spirits, rather than one single god." },
            { keyword: "thegn", description: "A noble in Anglo-Saxon society who served the king, often in exchange for land." },
            { keyword: "convert", description: "To change from one religion or set of beliefs to another." },
          ],
          misconceptions: [
            { misconception: "Pupils assume all Anglo-Saxons were Christian from the moment they arrived in Britain.", response: "Clarify that early Anglo-Saxons were pagans, worshipping several gods; Christianity spread gradually across Anglo-Saxon kingdoms over more than a century, starting from the late 6th century." },
            { misconception: "Pupils imagine Anglo-Saxon life as entirely primitive or unskilled, without recognising their genuine craftsmanship and organisation.", response: "Show examples like the treasures found at Sutton Hoo, including an intricately decorated helmet and fine jewellery, to demonstrate that Anglo-Saxon craftspeople were highly skilled, and Anglo-Saxon society was carefully structured, not simple or crude." },
          ],
          teacherTips: [
            "Use images of Sutton Hoo artefacts to challenge pupils' assumptions about Anglo-Saxon skill and status; the sheer craftsmanship of the objects found often surprises children.",
            "Draw a simple diagram of Anglo-Saxon society (king, thegns, farmers, enslaved people) to help pupils understand that it was structured, not equal, and that people's roles were often fixed by birth.",
          ],
          transcript:
            "Hello! Today we're finding out what everyday life was really like for the Anglo-Saxons, and what they believed in.\n\nMost Anglo-Saxons were farmers, living in small villages. Their houses were built from wood, with roofs made of thatch, bundles of straw or reeds tied tightly together. Families grew crops like wheat and barley, and kept animals such as pigs, sheep and cattle. Life revolved around the seasons: ploughing and planting in spring, harvesting in autumn, and surviving the cold winter months on stored food.\n\nAnglo-Saxon society had clear roles. Each kingdom had a king, who was supported by powerful nobles called thegns, who had usually been given land in exchange for loyalty and fighting for the king when needed. Most ordinary people were farmers, working the land. Sadly, some people in Anglo-Saxon society were enslaved, meaning they were owned by others and forced to work without freedom.\n\nWhat did the Anglo-Saxons believe? When they first arrived in Britain, they were pagans, meaning they worshipped several different gods, rather than one single god. Their gods included Woden, associated with wisdom and war, and Thunor, the god of thunder. You can still hear echoes of these gods in our days of the week, Wednesday comes from 'Woden's day', and Thursday from 'Thunor's day'. From the late 6th century onwards, missionaries began arriving from Europe, gradually converting Anglo-Saxon kingdoms to Christianity, though this took over a hundred years to spread across the whole of England.\n\nAnglo-Saxon people are sometimes wrongly imagined as unskilled or primitive. But archaeologists have discovered incredible evidence of their craftsmanship. At a site called Sutton Hoo, in Suffolk, a ship burial was discovered containing a stunningly decorated helmet, gold jewellery and fine metalwork, proving that Anglo-Saxon craftspeople had remarkable skill.\n\nA common mistake is assuming all Anglo-Saxons were Christian from the very beginning. In fact, they started as pagans, and Christianity spread gradually, kingdom by kingdom, over many decades.\n\nNow you'll explore some real Anglo-Saxon artefacts and what they tell us about daily life.",
          starterQuiz: [
            { kind: "mc", question: "Where did the Anglo-Saxons originally come from?", correct: ["Northern Europe"], distractors: ["Southern Europe", "North Africa", "Asia"] },
            { kind: "mc", question: "What is a kingdom?", correct: ["An area of land ruled by a king or queen"], distractors: ["A type of farm", "A group of enslaved people", "A Roman city"] },
            { kind: "short", question: "Name one Anglo-Saxon kingdom.", answers: ["Wessex", "Mercia", "Northumbria"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What does 'pagan' mean?", correct: ["Worshipping several gods or nature spirits"], distractors: ["Worshipping one single god", "Having no beliefs at all", "Following Roman laws"] },
            { kind: "mc", question: "Which discovery revealed the skill of Anglo-Saxon craftspeople?", correct: ["The Sutton Hoo ship burial"], distractors: ["Stonehenge", "The Roman baths at Bath", "Hadrian's Wall"] },
            { kind: "short", question: "Name one Anglo-Saxon god.", answers: ["Woden", "Thunor"] },
            { kind: "match", question: "Match each Anglo-Saxon role to its description.", pairs: [["King", "ruled a kingdom"], ["Thegn", "a noble who served the king"], ["Farmer", "grew crops and kept animals"]] },
            { kind: "order", question: "Order these events.", items: ["Anglo-Saxons arrive as pagans", "missionaries arrive from Europe", "Christianity gradually spreads across the kingdoms"] },
          ],
          worksheet: [
            { text: "What material were Anglo-Saxon roofs usually made from?", type: "short", answer: "thatch" },
            { text: "Name one Anglo-Saxon god and explain what he was associated with.", type: "short", answer: "Woden (wisdom and war) or Thunor (thunder)" },
            { text: "Explain what the discoveries at Sutton Hoo tell us about the Anglo-Saxons.", type: "extended", answer: "A good answer explains that the finely decorated helmet, gold jewellery and metalwork found at Sutton Hoo show that Anglo-Saxon craftspeople were highly skilled, challenging the idea that Anglo-Saxon society was primitive or unskilled." },
            { text: "Explain how and why Anglo-Saxon religious beliefs changed over time.", type: "extended", answer: "A good answer explains that Anglo-Saxons began as pagans worshipping several gods, and gradually converted to Christianity from the late 6th century onwards, as missionaries arrived from Europe and spread the new religion kingdom by kingdom." },
          ],
        },
        {
          slug: "viking-raids-and-invasion",
          title: "Viking raids and invasion",
          pupilLessonOutcome: "I can explain when the Viking raids began and how they affected Anglo-Saxon England.",
          keyLearningPoints: [
            "The first recorded Viking raid on Britain was on the monastery at Lindisfarne in AD 793.",
            "Vikings came from Scandinavia (modern-day Norway, Sweden and Denmark), and travelled by longship, a fast, sturdy vessel that could sail on open sea and shallow rivers.",
            "Early Viking attacks were sudden raids, often targeting monasteries, which were rich in treasure and poorly defended; later, Vikings began to settle permanently in parts of England.",
            "King Alfred the Great of Wessex successfully defended his kingdom against the Vikings and later reached an agreement that divided England, with the Vikings controlling an area called the Danelaw.",
          ],
          keywords: [
            { keyword: "raid", description: "A sudden, surprise attack, often to steal goods or treasure." },
            { keyword: "longship", description: "A fast, narrow Viking ship, built to sail across open sea and along shallow rivers." },
            { keyword: "Danelaw", description: "The area of England controlled by the Vikings, under Viking law, following agreements with Anglo-Saxon kings." },
          ],
          misconceptions: [
            { misconception: "Pupils think all Vikings only ever raided and never settled or lived peacefully in England.", response: "Explain that while early Viking activity was mostly raiding, many Vikings later settled permanently in England, farming, trading and even ruling parts of the country, particularly within the Danelaw." },
            { misconception: "Pupils think Alfred the Great defeated the Vikings completely and drove them out of Britain entirely.", response: "Clarify that Alfred successfully defended Wessex and won important victories, but the Vikings were not driven out of Britain altogether; instead, an agreement divided England, with Vikings controlling the Danelaw while Alfred ruled Wessex." },
          ],
          teacherTips: [
            "Use the Lindisfarne raid as a vivid, well-documented starting point, since a monk's written account of the attack survives and can be shared (in simplified form) to bring the event to life.",
            "Draw a simple map of England showing the Danelaw boundary, to help pupils visualise that Viking control was over part of England, not the whole country.",
          ],
          transcript:
            "Hello! Today we're learning about the Vikings, and how their raids changed Anglo-Saxon England.\n\nThe Vikings came from Scandinavia, from lands that are now Norway, Sweden and Denmark. They were skilled sailors, and built fast, sturdy ships called longships, which could sail across rough open sea, but were also narrow enough to travel up shallow rivers deep into England.\n\nThe first recorded Viking raid on Britain happened in the year AD 793, at a monastery called Lindisfarne, on the coast of Northumbria. A monastery is a religious community, and Lindisfarne was full of treasure, gold, silver, and holy objects, but had very few people to defend it. The Vikings arrived suddenly, attacked, stole what they could, and sailed away. This shocking event terrified people across Anglo-Saxon England, and monasteries along the coast became frequent targets in the years that followed, because they were rich but poorly protected.\n\nOver time, Viking activity changed. What started as sudden, hit-and-run raids gradually turned into something bigger: Vikings began arriving in large armies, fighting battles, and eventually settling permanently in parts of England, farming the land and building their own communities.\n\nOne Anglo-Saxon king stood out for successfully resisting the Vikings: Alfred the Great, king of Wessex. Alfred won important victories against Viking armies and worked hard to defend his kingdom. Eventually, an agreement was reached that divided England into two: Alfred ruled Wessex, in the south and west, while the Vikings controlled a large area called the Danelaw, in the north and east, where Viking law applied.\n\nA common mistake is thinking Alfred completely defeated the Vikings and drove them entirely out of Britain. That's not quite right, he successfully defended his own kingdom and won key battles, but the Vikings continued to control the Danelaw for many years afterwards.\n\nAnother mistake is imagining the Vikings only ever raided and never settled peacefully. In reality, many Vikings went on to live, farm, trade and raise families in England.\n\nNow you'll investigate a source about the Lindisfarne raid and think about how people reacted to it.",
          starterQuiz: [
            { kind: "mc", question: "What does it mean for people to be 'pagan'?", correct: ["Worshipping several gods or nature spirits"], distractors: ["Worshipping one single god", "Following no beliefs", "Practising Roman customs"] },
            { kind: "mc", question: "What were Anglo-Saxon houses usually built from?", correct: ["Wood, with thatched roofs"], distractors: ["Stone, with tiled roofs", "Brick, with slate roofs", "Ice"] },
            { kind: "short", question: "Name one Anglo-Saxon kingdom.", answers: ["Wessex", "Mercia", "Northumbria"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "Where did the first recorded Viking raid on Britain take place?", correct: ["Lindisfarne"], distractors: ["Sutton Hoo", "London", "York"] },
            { kind: "mc", question: "What was a longship?", correct: ["A fast Viking ship that could sail on open sea and shallow rivers"], distractors: ["A type of Anglo-Saxon farmhouse", "A Roman road", "A Viking sword"] },
            { kind: "short", question: "In what year did the first recorded Viking raid on Britain take place?", answers: ["793", "AD 793"] },
            { kind: "match", question: "Match each term to its meaning.", pairs: [["raid", "a sudden, surprise attack to steal goods"], ["longship", "a fast Viking ship"], ["Danelaw", "the area of England under Viking control and law"]] },
            { kind: "order", question: "Order these events chronologically.", items: ["the raid on Lindisfarne", "Vikings begin settling permanently in parts of England", "England is divided between Wessex and the Danelaw"] },
          ],
          worksheet: [
            { text: "In which year did the Vikings first raid Lindisfarne?", type: "short", answer: "AD 793" },
            { text: "Why were monasteries such as Lindisfarne common targets for Viking raids?", type: "short", answer: "they were rich in treasure but poorly defended" },
            { text: "Explain why it is inaccurate to say Alfred the Great drove the Vikings completely out of Britain.", type: "extended", answer: "A good answer explains that Alfred successfully defended Wessex and won important victories, but an agreement divided England instead, with the Vikings continuing to control the Danelaw rather than being driven out entirely." },
            { text: "Explain how Viking activity in England changed over time, from the first raids onwards.", type: "extended", answer: "A good answer explains that Viking activity began as sudden hit-and-run raids on rich, poorly defended targets like monasteries, and gradually changed into larger invasions, with Vikings eventually settling permanently and farming parts of England, particularly the Danelaw." },
          ],
        },
      ],
    },
    {
      slug: "ancient-greece",
      title: "Ancient Greece",
      description:
        "Pupils learn about the city states of Ancient Greece, everyday life for different groups of people, and the lasting legacy Ancient Greece has left on the modern world.",
      whyThisWhyNow:
        "This unit introduces pupils to one of the foundational civilisations of Western history, developing their understanding of democracy, culture and ideas that still shape life today.",
      priorKnowledge: [
        "Pupils understand that civilisations existed a very long time ago, before Britain's own history began in earnest.",
        "Pupils can use simple historical vocabulary such as 'BC' and 'ancient' to describe periods of time.",
        "Pupils know that different ancient civilisations had their own rulers, beliefs and ways of life.",
      ],
      nationalCurriculum: [
        "Ancient Greece: a study of Greek life and achievements and their influence on the western world.",
      ],
      lessons: [
        {
          slug: "ancient-greek-city-states",
          title: "Ancient Greek city states",
          pupilLessonOutcome: "I can explain what a city state was and compare two Ancient Greek city states, Athens and Sparta.",
          keyLearningPoints: [
            "Ancient Greece was not one single country; it was made up of many separate city states, each with its own government, laws and army.",
            "A city state, or 'polis', was an independent city along with the surrounding countryside and villages that it controlled.",
            "Athens was famous for developing an early form of democracy, where male citizens could vote on decisions.",
            "Sparta was famous for its powerful, highly trained army, and Spartan society was organised around military life from a young age.",
          ],
          keywords: [
            { keyword: "city state", description: "An independent city, together with its surrounding land, that governed itself with its own laws and army." },
            { keyword: "democracy", description: "A system of government where citizens vote on decisions or leaders, rather than being ruled by one all-powerful person." },
            { keyword: "citizen", description: "In Ancient Greece, a free person (usually a man) with the right to take part in decisions about their city state." },
          ],
          misconceptions: [
            { misconception: "Pupils think Ancient Greece was a single, unified country, like Greece is today.", response: "Explain that Ancient Greece was made up of many separate, independent city states, such as Athens and Sparta, which often had very different governments and customs, and even fought wars against each other." },
            { misconception: "Pupils think Athenian democracy worked exactly like democracy in Britain today, with everyone allowed to vote.", response: "Clarify that only free adult male citizens could vote in Athenian democracy; women, enslaved people and foreigners living in Athens had no vote at all, so it was very different from, and much less fair than, democracy today." },
          ],
          teacherTips: [
            "Use a simple comparison table (government, army, education, role of women) to help pupils see clearly how different Athens and Sparta were, despite both being Greek city states.",
            "Be precise and honest about who could vote in Athenian democracy; it's an important, thought-provoking point for pupils to grasp rather than gloss over.",
          ],
          transcript:
            "Hello! Today we're travelling to Ancient Greece, over two thousand years ago, to learn about city states.\n\nYou might imagine Ancient Greece as one single country, a bit like Greece today. But it wasn't. Ancient Greece was actually made up of many separate, independent city states. Each city state, sometimes called a 'polis', was its own little country really, with its own government, its own laws, and its own army, even though people living in different city states shared a similar language and similar gods.\n\nLet's compare two of the most famous city states: Athens and Sparta. They were both Greek, but they were remarkably different from each other.\n\nAthens is famous for developing an early form of democracy. The word democracy means 'rule by the people', and in Athens, male citizens could gather together and vote on important decisions affecting their city. This was a genuinely new idea at the time. However, it's important to know that Athenian democracy was far from equal by today's standards. Only free adult men who were citizens could vote. Women could not vote, enslaved people could not vote, and people who had moved to Athens from elsewhere could not vote either.\n\nSparta, meanwhile, was famous for something completely different: its powerful army. Spartan society was built almost entirely around military training. Spartan boys left home around the age of seven to begin intense military training, preparing them to become soldiers. Spartan society valued discipline, toughness and loyalty to the state above almost everything else.\n\nHere's a mistake to avoid. Some people assume Ancient Greece was one unified nation, but really, these separate city states were fiercely independent, and sometimes went to war against each other, including a long war between Athens and Sparta themselves.\n\nNow you're going to compare Athens and Sparta yourself, thinking about how different life would have been in each city state.",
          starterQuiz: [
            { kind: "mc", question: "What does 'ancient' mean?", correct: ["Belonging to a period of history a very long time ago"], distractors: ["Belonging to the present day", "Belonging to the future", "A type of government"] },
            { kind: "mc", question: "What is a government?", correct: ["The group of people who make decisions and laws for a country or city"], distractors: ["A type of army", "A religious building", "A form of currency"] },
            { kind: "short", question: "What does BC mean when used with a date?", answers: ["before Christ", "before the birth of Christ"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What was a city state in Ancient Greece?", correct: ["An independent city with its own government, laws and army"], distractors: ["A small village with no laws", "A region ruled entirely by Athens", "A type of Greek temple"] },
            { kind: "mc", question: "Which city state was famous for developing an early form of democracy?", correct: ["Athens"], distractors: ["Sparta", "Troy", "Corinth"] },
            { kind: "short", question: "Who could vote in Athenian democracy?", answers: ["free adult male citizens", "male citizens"] },
            { kind: "match", question: "Match each city state (or term) to what it was most famous for.", pairs: [["Athens", "an early form of democracy"], ["Sparta", "a powerful, highly trained army"], ["polis", "the Greek word for a city state"]] },
            { kind: "order", question: "Order these groups from most to least political power in Athenian democracy.", items: ["free adult male citizens", "women", "enslaved people"] },
          ],
          worksheet: [
            { text: "What was a Greek city state also called?", type: "short", answer: "a polis" },
            { text: "Name one thing Athens was famous for.", type: "short", answer: "democracy, or an early form of democracy" },
            { text: "Explain why Athenian democracy was very different from democracy in Britain today.", type: "extended", answer: "A good answer explains that only free adult male citizens could vote in Athens, while women, enslaved people and foreigners had no vote at all, unlike modern democracy where all adult citizens can usually vote." },
            { text: "Compare Athens and Sparta, describing one key difference between them.", type: "extended", answer: "A good answer describes a genuine difference, such as Athens developing an early democracy where citizens voted on decisions, while Sparta focused on producing a powerful, highly trained army through strict military training from childhood." },
          ],
        },
        {
          slug: "daily-life-in-ancient-greece",
          title: "Daily life in Ancient Greece",
          pupilLessonOutcome: "I can describe what daily life was like for different groups of people in Ancient Greece.",
          keyLearningPoints: [
            "Daily life in Ancient Greece was very different depending on whether you were a man, a woman, a child, or enslaved.",
            "Greek men who were citizens took part in public life, including politics, the marketplace (called the agora), and sport.",
            "Greek women mostly managed the household and had far fewer rights and freedoms than men; they could not vote or take part in politics.",
            "Enslaved people made up a significant part of the population in Ancient Greece and had no personal freedom, often doing hard labour or domestic work.",
          ],
          keywords: [
            { keyword: "agora", description: "The central marketplace and meeting place in an Ancient Greek city, used for trade, politics and public life." },
            { keyword: "household", description: "A home and the family (and enslaved people, where they were present) living and working within it." },
            { keyword: "rights", description: "The freedoms and powers a person is allowed to have within their society." },
          ],
          misconceptions: [
            { misconception: "Pupils assume everyone in Ancient Greece had the same experience of daily life, regardless of whether they were a man, woman, child, or enslaved person.", response: "Emphasise that daily life varied enormously depending on a person's status; a wealthy male citizen's daily routine looked completely different from that of a woman confined mostly to the home, or an enslaved person with no personal freedom at all." },
            { misconception: "Pupils think slavery in Ancient Greece was rare or unimportant.", response: "Explain clearly that enslaved people made up a significant part of the population in many Greek city states and were essential to how Greek society and economy functioned, doing much of the hard labour and domestic work." },
          ],
          teacherTips: [
            "Use short 'a day in the life' descriptions for different people (a male citizen, a woman, a child, an enslaved person) to make the contrast in daily experience vivid and concrete for pupils.",
            "Handle the topic of slavery honestly and sensitively, being clear it was a widespread and significant part of Ancient Greek society, not a minor detail.",
          ],
          transcript:
            "Hello! Today we're finding out what daily life was actually like for different people in Ancient Greece.\n\nIt's really important to understand that 'daily life in Ancient Greece' looked completely different depending on who you were. Being a man, a woman, a child, or an enslaved person meant very different daily experiences.\n\nLet's start with free male citizens. They took part in public life, spending time in the agora, the central marketplace and meeting place of the city, where people traded goods, discussed politics, and socialised. Male citizens could also take part in politics, sport, and religious festivals.\n\nWomen's lives looked very different. Greek women, especially in Athens, were expected to manage the household, running the home, raising children, weaving cloth, and organising food and supplies. Women had far fewer rights than men; they could not vote, could not own much property independently, and rarely left the house without a reason, especially in wealthier families.\n\nChildren's lives depended heavily on whether they were boys or girls, and how wealthy their family was. Boys from wealthier families often received an education, learning reading, writing, maths and sport, preparing them for public life as adults. Girls were usually taught skills needed to run a household, like weaving, rather than attending formal lessons.\n\nNow, an important and often overlooked part of Ancient Greek society: enslaved people. Slavery was widespread across Ancient Greece, and enslaved people made up a significant part of the population in many city states. They had no personal freedom and were forced to work, often doing hard physical labour, farming, or domestic work inside people's homes. Ancient Greek society and its economy relied heavily on their unpaid labour.\n\nA common mistake is imagining that everyone in Ancient Greece lived a similar life. In reality, your daily experience depended enormously on whether you were free or enslaved, male or female, rich or poor.\n\nNow you'll explore evidence about daily life for different groups of people in Ancient Greece.",
          starterQuiz: [
            { kind: "mc", question: "What was a city state?", correct: ["An independent city with its own government, laws and army"], distractors: ["A small farming village", "A type of Greek temple", "A Greek god"] },
            { kind: "mc", question: "Which city state was famous for its powerful army?", correct: ["Sparta"], distractors: ["Athens", "Corinth", "Troy"] },
            { kind: "short", question: "What is a citizen?", answers: ["a free person with rights to take part in decisions about their city", "a free person with political rights"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What was the agora?", correct: ["The central marketplace and meeting place of a Greek city"], distractors: ["A Greek temple", "A type of Greek ship", "A Spartan military camp"] },
            { kind: "mc", question: "What was expected of most Greek women?", correct: ["To manage the household"], distractors: ["To vote in the assembly", "To lead the army", "To rule the city state"] },
            { kind: "short", question: "What group of people had no personal freedom in Ancient Greece and were forced to work?", answers: ["enslaved people", "slaves"] },
            { kind: "match", question: "Match each group to a typical part of their life in Ancient Greece.", pairs: [["Male citizen", "took part in politics and visited the agora"], ["Woman", "managed the household"], ["Enslaved person", "had no personal freedom and was forced to work"]] },
            { kind: "order", question: "Order these groups from most rights to fewest rights in Ancient Greek society.", items: ["free adult male citizens", "free women", "enslaved people"] },
          ],
          worksheet: [
            { text: "What was the agora used for?", type: "short", answer: "trade, politics and public life (the marketplace and meeting place)" },
            { text: "Describe one way daily life for a Greek woman differed from daily life for a male citizen.", type: "short", answer: "women could not vote and mostly managed the household, unlike male citizens who took part in politics" },
            { text: "Explain why it would be inaccurate to say that everyone in Ancient Greece had a similar daily life.", type: "extended", answer: "A good answer explains that daily life varied hugely depending on whether someone was a free male citizen, a woman, a child, or enslaved, each having very different rights, responsibilities and freedoms." },
            { text: "Explain the role enslaved people played in Ancient Greek society.", type: "extended", answer: "A good answer explains that enslaved people made up a significant part of the population, had no personal freedom, and were forced to do hard labour and domestic work that Greek society and its economy relied upon." },
          ],
        },
        {
          slug: "the-legacy-of-ancient-greece",
          title: "The legacy of Ancient Greece",
          pupilLessonOutcome: "I can explain why Ancient Greece is considered important to the modern world.",
          keyLearningPoints: [
            "The word 'legacy' means something that is passed down and continues to have an effect long after it began.",
            "Ancient Greece gave the world an early form of democracy, an idea that has influenced how many modern countries, including the UK, are governed today.",
            "Ancient Greek thinkers, called philosophers, such as Socrates, Plato and Aristotle, developed ideas about knowledge, ethics and science that are still studied today.",
            "Many things from Ancient Greece continue today, including the Olympic Games, elements of theatre, and words in the English language that come from Ancient Greek.",
          ],
          keywords: [
            { keyword: "legacy", description: "Something that is passed down from the past and continues to have an effect on the present." },
            { keyword: "philosopher", description: "A person who studies deep questions about knowledge, existence, right and wrong, and how to live." },
            { keyword: "influence", description: "To have an effect on how something develops or is thought about." },
          ],
          misconceptions: [
            { misconception: "Pupils think Ancient Greece's influence ended when Ancient Greek civilisation itself ended, rather than continuing today.", response: "Show specific, concrete modern examples, like the Olympic Games or English words with Greek origins, to demonstrate that Ancient Greek ideas and traditions are still actively part of life today, not just historical facts." },
            { misconception: "Pupils think democracy today works in exactly the same way as it did in Ancient Athens.", response: "Remind pupils of the earlier lesson: only free adult male citizens could vote in Athens, while modern democracies allow all adult citizens to vote; the core idea of citizens having a say was inherited from Greece, but the system itself has changed a great deal." },
          ],
          teacherTips: [
            "Build a simple 'then and now' table linking specific Ancient Greek achievements (democracy, Olympic Games, philosophy, theatre) to their modern equivalents, to make the idea of legacy concrete.",
            "Point out everyday English words with Greek origins (e.g. 'democracy', 'philosophy', 'marathon', 'theatre') to show pupils that Ancient Greek influence is embedded even in the language they use.",
          ],
          transcript:
            "Hello! Today we're asking a big question: why do people still talk about Ancient Greece, thousands of years after it existed?\n\nThe answer has a lot to do with something called legacy. A legacy is something passed down from the past that keeps having an effect long after it began. Ancient Greece left behind an enormous legacy that still shapes the world today.\n\nLet's start with democracy. We learned earlier that Athens developed an early form of democracy, where citizens could vote on decisions. That idea, citizens having a say in how they are governed, was hugely influential. Many modern countries, including the UK, base their system of government on the idea that citizens should have a voice, an idea that can be traced back to Ancient Greece, even though modern democracy works quite differently and is much fairer, allowing all adults to vote, not just free men.\n\nAncient Greece also gave the world philosophy, deep thinking about questions like: what is knowledge? What is right and wrong? How should people live? Famous Greek philosophers like Socrates, Plato and Aristotle developed ideas that are still studied by students today, thousands of years later.\n\nYou've probably heard of the Olympic Games. They began in Ancient Greece, as a sporting competition held in honour of the god Zeus. The modern Olympic Games, held every four years, are directly inspired by this ancient tradition.\n\nEven our language carries Ancient Greek influence. Words like 'democracy', 'philosophy', 'theatre' and 'marathon' all come from Ancient Greek. In fact, the word 'marathon' comes from a Greek soldier's legendary run to deliver news of a battle victory.\n\nA common mistake is thinking Ancient Greece's influence simply stopped when their civilisation ended. Actually, their ideas, words and traditions are still very much part of our lives today, we just don't always notice it.\n\nNow you'll investigate specific examples of Ancient Greek legacy and explain how they connect to the modern world.",
          starterQuiz: [
            { kind: "mc", question: "What was the agora?", correct: ["The central marketplace and meeting place of a Greek city"], distractors: ["A Greek warship", "A type of temple", "A Spartan training camp"] },
            { kind: "mc", question: "Who could vote in Athenian democracy?", correct: ["Free adult male citizens"], distractors: ["All adults", "Only women", "Only enslaved people"] },
            { kind: "short", question: "What is a philosopher?", answers: ["a person who studies deep questions about knowledge and how to live", "someone who thinks deeply about knowledge and ethics"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What does 'legacy' mean?", correct: ["Something passed down from the past that still has an effect today"], distractors: ["A type of Ancient Greek government", "A Greek soldier", "An ancient building"] },
            { kind: "mc", question: "Which modern sporting event began in Ancient Greece?", correct: ["The Olympic Games"], distractors: ["The football World Cup", "The Tour de France", "The Rugby World Cup"] },
            { kind: "short", question: "Name one Ancient Greek philosopher.", answers: ["Socrates", "Plato", "Aristotle"] },
            { kind: "match", question: "Match each Ancient Greek achievement to its modern legacy.", pairs: [["Athenian democracy", "modern systems of government where citizens vote"], ["Ancient Olympic Games", "the modern Olympic Games"], ["Greek philosophers", "ideas about knowledge and ethics still studied today"]] },
            { kind: "order", question: "Order these events chronologically.", items: ["the first Ancient Olympic Games take place", "Ancient Greek philosophers develop new ideas", "the modern Olympic Games begin"] },
          ],
          worksheet: [
            { text: "What does the word 'legacy' mean?", type: "short", answer: "something passed down from the past that still has an effect today" },
            { text: "Name one modern thing that has its origins in Ancient Greece.", type: "short", answer: "the Olympic Games, democracy, philosophy, theatre, or a Greek-origin word" },
            { text: "Explain how the idea of democracy from Ancient Greece has influenced government in the UK today.", type: "extended", answer: "A good answer explains that Ancient Athens introduced the idea of citizens voting on decisions, and this idea of citizens having a voice in government has influenced modern democracies like the UK, even though the modern system allows all adults to vote, unlike ancient Athens." },
            { text: "Explain why it would be a mistake to think Ancient Greece's influence ended when the civilisation itself ended.", type: "extended", answer: "A good answer gives concrete evidence that Ancient Greek influence continues today, such as the modern Olympic Games, philosophical ideas still studied, and English words like 'democracy' and 'marathon' that come from Ancient Greek." },
          ],
        },
      ],
    },
  ],
};
