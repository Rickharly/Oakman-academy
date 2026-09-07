import type { SubjectYearSpec } from "./types";

export const geographyYear5: SubjectYearSpec = {
  subject: { slug: "geography", title: "Geography" },
  programme: {
    sequenceSlug: "geography-primary",
    yearGroup: 5,
    keyStage: "ks2",
    phase: "primary",
    title: "Geography — Year 5",
  },
  units: [
    {
      slug: "rivers-and-the-water-cycle",
      title: "Rivers and the water cycle",
      description:
        "Pupils learn how the water cycle works, identify the main features of a river from source to mouth, and explore the causes and effects of flooding.",
      whyThisWhyNow:
        "This unit builds pupils' understanding of a key physical geography process, connecting the water cycle to real river systems and preparing them to explain natural hazards like flooding.",
      priorKnowledge: [
        "Pupils know that water exists as a solid, liquid and gas, and can change between these states.",
        "Pupils have observed everyday examples of evaporation and condensation, e.g. a puddle drying up, condensation on a window.",
        "Pupils can locate rivers on a map and know that rivers flow into the sea.",
      ],
      nationalCurriculum: [
        "Describe and understand key aspects of physical geography, including the water cycle and rivers.",
      ],
      lessons: [
        {
          slug: "the-water-cycle-explained",
          title: "The water cycle explained",
          pupilLessonOutcome: "I can describe the water cycle using the correct scientific vocabulary.",
          keyLearningPoints: [
            "The water cycle is the continuous journey water takes as it moves between the sea, the air and the land.",
            "Evaporation is when the Sun heats water and turns it from a liquid into water vapour, a gas, which rises into the air.",
            "Condensation is when water vapour cools high in the sky and turns back into tiny liquid droplets, forming clouds.",
            "Precipitation is when water falls from clouds back to the Earth's surface, as rain, snow, sleet or hail, and then collects and flows back towards the sea, continuing the cycle.",
          ],
          keywords: [
            { keyword: "evaporation", description: "The process of a liquid turning into a gas, e.g. when the Sun heats water and it rises into the air as water vapour." },
            { keyword: "condensation", description: "The process of a gas cooling and turning back into a liquid, e.g. water vapour forming clouds or droplets." },
            { keyword: "precipitation", description: "Water falling from clouds to the ground as rain, snow, sleet or hail." },
          ],
          misconceptions: [
            { misconception: "Pupils think the water cycle has a clear beginning and end, rather than being a continuous, repeating process.", response: "Explain that the water cycle has no true starting point; water is constantly moving between the sea, air and land in an endless loop, so we can start describing it from any stage and it will always lead back to where we began." },
            { misconception: "Pupils confuse evaporation and condensation, or think they are the same process.", response: "Contrast the two directly: evaporation is a liquid turning into a gas (heating), while condensation is a gas turning back into a liquid (cooling) — they are opposite processes." },
          ],
          teacherTips: [
            "Use a simple diagram with arrows showing the cycle, and get pupils to trace the path of a single water droplet through evaporation, condensation, precipitation and collection.",
            "Link evaporation and condensation to everyday, observable examples, like water disappearing from a puddle, or condensation appearing on a cold window or mirror.",
          ],
          transcript:
            "Hello! Today we're learning about the water cycle, the amazing, never-ending journey water takes around our planet.\n\nLet's imagine a drop of water sitting in the sea. The Sun heats the surface of the sea, warming that water. As it warms, it changes from a liquid into a gas called water vapour, and rises up into the air. This process, a liquid turning into a gas because of heat, is called evaporation.\n\nAs the water vapour rises higher into the sky, it reaches cooler air. When something cools down, the opposite of evaporation happens: the water vapour turns back from a gas into tiny liquid water droplets. This process is called condensation. Millions of these tiny droplets clump together in the sky, forming what we see as clouds.\n\nInside a cloud, the water droplets keep bumping into each other and joining up, growing bigger and heavier. Eventually, they become too heavy to stay floating in the air, and they fall back down to Earth. We call this precipitation, and it can fall as rain, snow, sleet or hail, depending on the temperature.\n\nOnce precipitation reaches the ground, the water doesn't just stop there. It collects in rivers, lakes and streams, and gradually flows downhill, eventually making its way back to the sea. And once it's back in the sea, the whole process can begin again: evaporation, condensation, precipitation, collection.\n\nHere's something important to understand: the water cycle doesn't really have a beginning or an end. It's a continuous loop, water keeps moving round and round between the sea, the air and the land, forever.\n\nA common mistake is mixing up evaporation and condensation. Remember: evaporation is heating, a liquid becoming a gas, rising up. Condensation is cooling, a gas becoming a liquid again, forming clouds. They're exact opposites of each other.\n\nNow you'll practise describing the water cycle in the correct order, using all the key vocabulary.",
          starterQuiz: [
            { kind: "mc", question: "What are the three states that water can exist in?", correct: ["Solid, liquid and gas"], distractors: ["Hot, warm and cold", "Rain, snow and hail", "Sea, river and lake"] },
            { kind: "mc", question: "What happens to water when it is heated enough?", correct: ["It turns into a gas"], distractors: ["It turns into a solid", "It disappears completely", "It becomes heavier"] },
            { kind: "short", question: "Give an example of water as a solid.", answers: ["ice", "snow"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is evaporation?", correct: ["A liquid turning into a gas because of heat"], distractors: ["A gas turning into a liquid because of cooling", "Water falling from clouds", "Water flowing downhill"] },
            { kind: "mc", question: "What is condensation?", correct: ["A gas cooling and turning back into a liquid"], distractors: ["A liquid heating and turning into a gas", "Water falling as rain", "Water freezing into ice"] },
            { kind: "short", question: "What is the name for water falling from clouds as rain, snow, sleet or hail?", answers: ["precipitation"] },
            { kind: "match", question: "Match each stage of the water cycle to its correct description.", pairs: [["Evaporation", "water heats up and turns into a gas"], ["Condensation", "water vapour cools and forms clouds"], ["Precipitation", "water falls from clouds to the ground"]] },
            { kind: "order", question: "Order these stages of the water cycle.", items: ["evaporation", "condensation", "precipitation", "collection"] },
          ],
          worksheet: [
            { text: "What is evaporation?", type: "short", answer: "a liquid turning into a gas because of heat" },
            { text: "What is condensation?", type: "short", answer: "a gas cooling and turning back into a liquid" },
            { text: "Explain why the water cycle is described as a continuous cycle rather than having a clear beginning and end.", type: "extended", answer: "A good answer explains that water is constantly moving between the sea, air and land through evaporation, condensation, precipitation and collection, in an endless loop with no true starting point." },
            { text: "Describe, in order, what happens to a drop of water from the moment it evaporates from the sea to the moment it returns to the sea.", type: "extended", answer: "A good answer describes the sequence: the water evaporates from the sea into water vapour, rises and cools to condense into clouds, falls as precipitation, and then collects and flows through rivers back to the sea." },
          ],
        },
        {
          slug: "river-features-source-to-mouth",
          title: "River features: source to mouth",
          pupilLessonOutcome: "I can name and describe the key features of a river from its source to its mouth.",
          keyLearningPoints: [
            "A river's source is where it begins, often high up in hills or mountains, fed by rainfall or melting snow.",
            "A river's mouth is where it finally flows into the sea, a lake, or another river.",
            "As a river travels from its source to its mouth, it usually gets wider, deeper and slower, and is joined by smaller rivers called tributaries.",
            "A meander is a bend or curve in a river, usually found in the middle or lower course, where the river flows across flatter land.",
          ],
          keywords: [
            { keyword: "source", description: "The place where a river begins, often in hills or mountains." },
            { keyword: "mouth", description: "The place where a river flows into the sea, a lake, or another river." },
            { keyword: "tributary", description: "A smaller river or stream that joins and flows into a larger river." },
          ],
          misconceptions: [
            { misconception: "Pupils think a river flows at the same speed and width along its whole length.", response: "Explain that a river typically starts narrow, fast and shallow near its source in the hills, and becomes wider, slower and deeper as it travels towards its mouth, picking up water from tributaries along the way." },
            { misconception: "Pupils confuse the words 'source' and 'mouth', or think the mouth is where a river begins.", response: "Use the memorable phrase 'source starts it, mouth finishes it' and trace a real river on a map from its beginning in the hills to where it meets the sea, to fix the two terms firmly in the right order." },
          ],
          teacherTips: [
            "Trace a real, well-known river (such as the Thames or the Severn) on a map from source to mouth, pointing out tributaries joining along the way, to make the abstract vocabulary concrete.",
            "Use the analogy of a river's journey being a bit like a person's life story, starting small in the hills and 'growing up' as it heads towards the sea, to help pupils remember the general pattern of change.",
          ],
          transcript:
            "Hello! Today we're following the journey of a river, from where it begins to where it ends, and learning the names for its key features along the way.\n\nEvery river has to start somewhere. This starting point is called the source. A river's source is often high up in hills or mountains, where rainfall collects, or where melting snow feeds a small stream trickling downhill.\n\nFrom its source, the river begins its journey, and gradually, other smaller rivers and streams join it along the way. We call these smaller rivers tributaries. Each time a tributary joins, it adds more water to the main river.\n\nAs a river flows from its source towards the sea, it usually changes quite a lot. Near the source, in the hills, a river tends to be narrow, shallow and fast-flowing, often tumbling over rocks. As it travels further, picking up water from tributaries, it usually becomes wider, deeper and slower. By the time it reaches flatter land, the river often develops big, sweeping bends called meanders, curving gently across the landscape instead of rushing in a straight line.\n\nEventually, every river reaches its final destination. This ending point is called the mouth, the place where the river flows into the sea, a lake, or sometimes another larger river. At the mouth, a river is usually at its widest, deepest and slowest.\n\nA useful way to remember the difference between these two important terms is: 'source starts it, mouth finishes it.'\n\nA common mistake is thinking a river stays the same width and speed throughout its whole journey. In reality, rivers change dramatically, starting fast, narrow and shallow near the source, and becoming wide, deep and slow by the time they reach the mouth.\n\nAnother mistake is muddling up source and mouth, sometimes thinking the mouth is where a river begins.\n\nNow you'll trace a river on a map, labelling its source, tributaries, meanders and mouth.",
          starterQuiz: [
            { kind: "mc", question: "What is evaporation?", correct: ["A liquid turning into a gas because of heat"], distractors: ["A gas turning into a liquid", "Water falling as rain", "Water freezing"] },
            { kind: "mc", question: "What is precipitation?", correct: ["Water falling from clouds as rain, snow, sleet or hail"], distractors: ["Water rising into the air", "Water flowing into rivers", "Water freezing into ice"] },
            { kind: "short", question: "Name a UK river you have heard of.", answers: ["Thames", "Severn", "Trent", "Mersey", "Avon"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is the source of a river?", correct: ["The place where a river begins"], distractors: ["The place where a river ends", "A bend in a river", "A smaller river joining a larger one"] },
            { kind: "mc", question: "What is a tributary?", correct: ["A smaller river or stream that joins a larger river"], distractors: ["The end of a river", "The start of a river", "A type of meander"] },
            { kind: "short", question: "What is the name for the place where a river flows into the sea?", answers: ["the mouth", "mouth"] },
            { kind: "match", question: "Match each term to its correct meaning.", pairs: [["Source", "where a river begins"], ["Mouth", "where a river ends, meeting the sea"], ["Meander", "a bend or curve in a river"]] },
            { kind: "order", question: "Order these features as they would typically appear along a river's journey from source to mouth.", items: ["source", "tributary joining", "meander", "mouth"] },
          ],
          worksheet: [
            { text: "What is the source of a river?", type: "short", answer: "the place where a river begins" },
            { text: "What is a meander?", type: "short", answer: "a bend or curve in a river" },
            { text: "Explain how a river typically changes as it travels from its source to its mouth.", type: "extended", answer: "A good answer explains that a river usually starts narrow, shallow and fast near its source in the hills, and becomes wider, deeper and slower as it is joined by tributaries and travels towards its mouth." },
            { text: "Explain the difference between a river's source and a river's mouth.", type: "extended", answer: "A good answer explains that the source is where a river begins, often in hills or mountains, while the mouth is where the river ends, flowing into the sea, a lake, or another river." },
          ],
        },
        {
          slug: "causes-and-effects-of-flooding",
          title: "Causes and effects of flooding",
          pupilLessonOutcome: "I can explain some common causes of flooding and describe its effects on people and places.",
          keyLearningPoints: [
            "A flood happens when a river receives more water than its channel can hold, causing water to spill over onto the surrounding land.",
            "Common causes of flooding include heavy or prolonged rainfall, snow melting quickly, and land that cannot absorb water well, such as concrete surfaces in towns and cities.",
            "Flooding can affect people by damaging homes and belongings, disrupting travel, and in serious cases putting lives at risk.",
            "Flooding can affect the land by depositing fertile silt (which can help farming), but also by eroding riverbanks and damaging habitats.",
          ],
          keywords: [
            { keyword: "flood", description: "When water spills out of a river's normal channel and covers the surrounding land." },
            { keyword: "absorb", description: "To soak up or take in a liquid, e.g. soil absorbing rainwater." },
            { keyword: "silt", description: "Fine particles of soil and rock, often left behind by floodwater as it recedes." },
          ],
          misconceptions: [
            { misconception: "Pupils think flooding is always caused directly and only by heavy rain falling in that exact location at that time.", response: "Explain that flooding can also be caused by heavy rain or melting snow further upstream arriving later, or by land nearby being unable to absorb water well, such as concrete and tarmac in towns, so the cause isn't always local, immediate rainfall." },
            { misconception: "Pupils think flooding is entirely bad, with no positive effects at all.", response: "Point out that floodwater can deposit fertile silt onto farmland as it recedes, which can actually improve the soil for growing crops, alongside its more serious and damaging effects on homes and safety." },
          ],
          teacherTips: [
            "Use a real, age-appropriate case study of a UK flood event to make causes and effects concrete, focusing on factual impact rather than distressing detail.",
            "Discuss how towns and cities, with lots of concrete and tarmac, can make flooding worse because rainwater cannot soak into the ground as it would in fields or woodland.",
          ],
          transcript:
            "Hello! Today we're learning about flooding, what causes it, and how it affects people and places.\n\nA river normally flows within its channel, the path cut into the land that the water travels along. A flood happens when a river receives more water than its channel can hold, so the water spills out over the surrounding land, called a floodplain.\n\nWhat causes this extra water? The most common cause is heavy or prolonged rainfall, lots of rain falling over a short time, or rain that keeps falling for days. Sometimes flooding is caused by snow melting quickly, especially after a sudden rise in temperature, sending a large amount of water into rivers all at once. Flooding doesn't always come from rain falling in the exact place that floods, either, heavy rainfall further upstream can travel down a river and cause flooding somewhere else entirely.\n\nThe type of land nearby matters too. Soil and grassy fields can absorb, or soak up, a good amount of rainwater. But hard surfaces, like the concrete and tarmac found in towns and cities, cannot absorb water at all, so rain runs straight off these surfaces into drains and rivers very quickly, making flooding more likely in built-up areas.\n\nFlooding can have serious effects on people. Floodwater can damage homes, destroying belongings and furniture, and forcing families to leave until it's safe to return. Roads can become impassable, disrupting travel and daily life, and in severe cases, flooding can put people's safety at risk.\n\nFlooding isn't only damaging, though. As floodwater eventually recedes, it often leaves behind silt, fine particles of soil and rock carried by the water. This silt can actually make farmland more fertile, helping crops grow well in the following season.\n\nA common mistake is assuming flooding is always caused by rain falling in that exact spot, when it can also result from rainfall or snowmelt much further upstream. Another mistake is thinking flooding is entirely negative, when it can also bring benefits like fertile soil, alongside its very real risks and damage.\n\nNow you'll investigate a real example of flooding and consider its causes and effects.",
          starterQuiz: [
            { kind: "mc", question: "What is the source of a river?", correct: ["The place where a river begins"], distractors: ["The place where a river ends", "A bend in a river", "The middle of a river"] },
            { kind: "mc", question: "What is a tributary?", correct: ["A smaller river that joins a larger river"], distractors: ["The end of a river", "A type of flood", "A type of cloud"] },
            { kind: "short", question: "What is the name for water falling from clouds?", answers: ["precipitation"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is a flood?", correct: ["When water spills out of a river's channel onto the surrounding land"], distractors: ["When a river dries up completely", "When a river changes direction", "When a river freezes over"] },
            { kind: "mc", question: "Which of these can make flooding worse in towns and cities?", correct: ["Concrete and tarmac, which do not absorb water"], distractors: ["Grassy fields, which absorb water well", "Trees, which absorb water well", "Soil, which absorbs water well"] },
            { kind: "short", question: "What is silt?", answers: ["fine particles of soil and rock left behind by floodwater"] },
            { kind: "match", question: "Match each cause to how it can lead to flooding.", pairs: [["Heavy, prolonged rainfall", "adds more water than a river channel can hold"], ["Snow melting quickly", "sends a large amount of water into rivers at once"], ["Concrete and tarmac surfaces", "stop rainwater soaking into the ground"]] },
            { kind: "order", question: "Order these events in a flood.", items: ["heavy rainfall falls over several days", "the river channel fills beyond capacity", "water spills onto the floodplain", "floodwater eventually recedes leaving silt behind"] },
          ],
          worksheet: [
            { text: "Name one cause of flooding.", type: "short", answer: "heavy or prolonged rainfall, or rapidly melting snow" },
            { text: "Why can concrete and tarmac in towns and cities make flooding worse?", type: "short", answer: "they do not absorb water, so rain runs off quickly into rivers and drains" },
            { text: "Explain one negative and one positive effect of flooding.", type: "extended", answer: "A good answer names a negative effect such as damage to homes, belongings or safety risk, and a positive effect such as fertile silt being deposited on farmland, improving the soil for growing crops." },
            { text: "Explain why flooding in one place can sometimes be caused by rainfall that fell somewhere else entirely.", type: "extended", answer: "A good answer explains that heavy rain or melting snow falling further upstream flows down the river system and adds extra water downstream, which can cause flooding in a location even if it did not rain heavily there." },
          ],
        },
      ],
    },
    {
      slug: "biomes-and-climate-zones",
      title: "Biomes and climate zones",
      description:
        "Pupils learn about the world's major climate zones, explore the characteristics of rainforest biomes, and investigate the characteristics of desert biomes.",
      whyThisWhyNow:
        "This unit develops pupils' understanding of how climate shapes different environments around the world, building geographical knowledge that connects to their work on rivers and the water cycle.",
      priorKnowledge: [
        "Pupils know that different parts of the world have different weather and climates.",
        "Pupils can identify hot and cold regions of the world on a map, such as the Equator and the Poles.",
        "Pupils understand that plants and animals are suited (adapted) to the environments they live in.",
      ],
      nationalCurriculum: [
        "Describe and understand key aspects of physical geography, including climate zones, biomes and vegetation belts.",
        "Locate the world's countries, using maps to focus on environmental regions, including hot and cold areas of the world.",
      ],
      lessons: [
        {
          slug: "world-climate-zones",
          title: "World climate zones",
          pupilLessonOutcome: "I can describe the world's major climate zones and explain what causes them.",
          keyLearningPoints: [
            "A climate zone is a large area of the world with a similar pattern of weather over many years.",
            "The world's main climate zones include polar (very cold), temperate (mild, with four seasons), and tropical (hot, near the Equator).",
            "Climate zones are mainly caused by how directly the Sun's heat hits different parts of the Earth's curved surface.",
            "Places near the Equator receive more direct, concentrated sunlight all year round, making them hot, while places near the Poles receive weaker, more spread-out sunlight, making them cold.",
          ],
          keywords: [
            { keyword: "climate", description: "The usual pattern of weather in a place over a long period of time, such as many years." },
            { keyword: "Equator", description: "An imaginary line around the middle of the Earth, halfway between the North and South Poles." },
            { keyword: "climate zone", description: "A large region of the world with a broadly similar climate." },
          ],
          misconceptions: [
            { misconception: "Pupils confuse 'weather' and 'climate', thinking they mean the same thing.", response: "Explain the key difference: weather is what is happening outside right now or on a particular day, while climate is the usual, long-term pattern of weather in a place over many years; one cold day doesn't change a region's climate." },
            { misconception: "Pupils think temperature only depends on how close a place is to the Sun in space, rather than the angle sunlight hits the Earth's surface.", response: "Clarify that every place on Earth is roughly the same distance from the Sun; what changes is the angle sunlight strikes the curved surface of the Earth — direct, concentrated sunlight near the Equator makes it hot, while weaker, more spread-out sunlight near the Poles makes it cold." },
          ],
          teacherTips: [
            "Use a torch and a globe to physically demonstrate how sunlight spreads out more when it hits the curved surface near the Poles compared with hitting it directly near the Equator, making the abstract idea visible.",
            "Keep reinforcing the weather versus climate distinction throughout the unit, since pupils often revert to using the words interchangeably.",
          ],
          transcript:
            "Hello! Today we're learning about the world's climate zones, and finding out what actually causes them.\n\nFirst, let's clear up an important difference: weather and climate are not the same thing. Weather is what's happening outside right now, or on one particular day, sunny, rainy, cold, windy. Climate is the usual pattern of weather in a place over a very long time, many years. A single cold, rainy day in a normally hot country doesn't change that country's climate at all.\n\nDifferent parts of the world have very different climates, and we can group areas with similar climates into climate zones. Near the Equator, an imaginary line running around the middle of the Earth, the climate is tropical, meaning hot all year round. Nearer the North and South Poles, the climate is polar, extremely cold for most or all of the year. In between, many places, including the UK, have a temperate climate, with four distinct seasons and generally mild temperatures.\n\nSo what actually causes these different climate zones? It's all about the angle sunlight hits the Earth's curved surface. Near the Equator, sunlight hits the Earth almost directly, straight on, concentrating its heat into a smaller area, which makes it hot. Near the Poles, sunlight hits the Earth at a much more slanted angle, spreading the same amount of heat over a much larger area, which makes it far weaker and colder.\n\nHere's a common mistake. Some people think places are hotter or colder depending on how close they are to the Sun in space, but actually, every part of the Earth is roughly the same distance from the Sun. What really matters is the angle sunlight strikes the surface at, not the distance travelled.\n\nAnother mistake is muddling weather and climate. Remember: weather changes day to day, climate describes the usual pattern over many years.\n\nNow you'll locate different climate zones on a world map and describe their typical characteristics.",
          starterQuiz: [
            { kind: "mc", question: "What is the Equator?", correct: ["An imaginary line around the middle of the Earth"], distractors: ["A line around the top of the Earth", "A line marking a country's border", "The path the Moon takes around the Earth"] },
            { kind: "mc", question: "Which of these is an example of weather?", correct: ["It is raining today"], distractors: ["The Sahara is usually hot and dry", "The UK has four seasons", "The Arctic is usually very cold"] },
            { kind: "short", question: "What season comes after winter in the UK?", answers: ["spring"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is climate?", correct: ["The usual pattern of weather in a place over many years"], distractors: ["What is happening outside today", "A type of map", "The temperature right now"] },
            { kind: "mc", question: "Why is it hot near the Equator?", correct: ["Sunlight hits the Earth's surface there almost directly"], distractors: ["The Equator is closer to the Sun", "There are no clouds at the Equator", "The Equator has no seasons"] },
            { kind: "short", question: "Name the three main climate zones described in this lesson.", answers: ["polar, temperate, tropical", "tropical, temperate, polar"] },
            { kind: "match", question: "Match each climate zone to its typical description.", pairs: [["Polar", "very cold for most or all of the year"], ["Temperate", "mild with four distinct seasons"], ["Tropical", "hot all year round"]] },
            { kind: "order", question: "Order these climate zones from coldest to hottest.", items: ["polar", "temperate", "tropical"] },
          ],
          worksheet: [
            { text: "What is the difference between weather and climate?", type: "short", answer: "weather is the day-to-day conditions, climate is the usual pattern over many years" },
            { text: "Name the climate zone that the UK is mostly located in.", type: "short", answer: "temperate" },
            { text: "Explain why places near the Equator are hotter than places near the Poles.", type: "extended", answer: "A good answer explains that sunlight hits the Earth's surface almost directly near the Equator, concentrating its heat into a smaller area, while near the Poles sunlight hits at a slanted angle, spreading the same heat over a larger area and making it weaker." },
            { text: "Explain why 'the Equator is closer to the Sun' is not a correct explanation for why it is hot there.", type: "extended", answer: "A good answer explains that every part of the Earth is roughly the same distance from the Sun; the real reason the Equator is hotter is the angle at which sunlight strikes the Earth's curved surface, not the distance to the Sun." },
          ],
        },
        {
          slug: "rainforest-biomes",
          title: "Rainforest biomes",
          pupilLessonOutcome: "I can describe the key characteristics of a rainforest biome and explain why it supports so much life.",
          keyLearningPoints: [
            "A biome is a large natural area with a particular climate, and plants and animals adapted to live there.",
            "Tropical rainforests are found near the Equator, and are characterised by high temperatures and very heavy rainfall all year round.",
            "A rainforest has distinct layers: the emergent layer (tallest trees), the canopy (a dense layer of treetops), the understory (smaller plants that get little light), and the forest floor.",
            "Rainforests cover a small percentage of the Earth's land but are home to an extraordinary proportion of the world's plant and animal species.",
          ],
          keywords: [
            { keyword: "biome", description: "A large natural area of the world with a particular climate and plants and animals suited to living there." },
            { keyword: "canopy", description: "The dense layer of leaves and branches formed by the tops of rainforest trees, high above the ground." },
            { keyword: "adapted", description: "Having features or behaviours suited to survive well in a particular environment." },
          ],
          misconceptions: [
            { misconception: "Pupils think all of a rainforest looks the same throughout, without distinct layers.", response: "Show a labelled cross-section diagram of a rainforest, and explain that different layers (emergent, canopy, understory, forest floor) receive very different amounts of light and support different types of plants and animals." },
            { misconception: "Pupils think rainforests are found all over the world in any hot country, rather than specifically near the Equator.", response: "Clarify that tropical rainforests need both high temperatures and very heavy rainfall all year round, a combination mostly found in a band of countries close to the Equator, not simply any hot place; some hot places, like deserts, are actually very dry." },
          ],
          teacherTips: [
            "Use a labelled diagram of rainforest layers alongside real examples of animals found at each layer (e.g. eagles in the emergent layer, monkeys in the canopy, jaguars on the forest floor) to make the structure memorable.",
            "Emphasise the huge proportion of the world's species found in rainforests despite their relatively small land coverage, to help pupils appreciate their ecological importance.",
          ],
          transcript:
            "Hello! Today we're exploring one of the most amazing biomes on Earth: the tropical rainforest.\n\nA biome is a large natural area of the world with its own particular climate, and its own plants and animals that are adapted, meaning suited, to living there. Tropical rainforests are one of the most famous biomes, found mainly in a band of countries close to the Equator, including parts of Brazil, the Democratic Republic of Congo, and Indonesia.\n\nWhat makes a rainforest a rainforest? Two things, mainly: very high temperatures, staying warm all year round, and enormous amounts of rainfall, spread fairly evenly throughout the year rather than in just one season.\n\nBecause of this warmth and rainfall, an incredible amount of plant life grows in a rainforest, and it organises itself into distinct layers. Right at the top is the emergent layer, made up of the very tallest trees, poking up above everything else. Below that is the canopy, a thick, leafy layer formed by the tops of most rainforest trees, so dense that it blocks a huge amount of sunlight from reaching the ground. Beneath the canopy is the understory, home to smaller plants that have adapted to survive with much less light. Finally, right at the bottom, is the forest floor, dark and often surprisingly clear of plants, because so little sunlight makes it all the way down.\n\nRainforests only cover a small percentage of the Earth's total land area, yet they are home to an extraordinary proportion of the world's plant and animal species; scientists estimate rainforests contain more than half of all species on Earth, despite their limited size.\n\nA common mistake is imagining a rainforest as one uniform, tangled mass of plants throughout. Actually, it has clear layers, each with very different light levels and different animals adapted to live there.\n\nAnother mistake is thinking any hot country automatically has a rainforest. Rainforests specifically need very heavy rainfall as well as heat, some hot places, like deserts, are actually extremely dry.\n\nNow you'll explore the layers of a rainforest and the animals that live in each one.",
          starterQuiz: [
            { kind: "mc", question: "What is climate?", correct: ["The usual pattern of weather in a place over many years"], distractors: ["The weather on one particular day", "A type of map", "A season of the year"] },
            { kind: "mc", question: "Which climate zone is closest to the Equator?", correct: ["Tropical"], distractors: ["Polar", "Temperate", "Arctic"] },
            { kind: "short", question: "What does 'adapted' mean?", answers: ["having features suited to survive in a particular environment", "suited to living somewhere"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is a biome?", correct: ["A large natural area with a particular climate and its own plants and animals"], distractors: ["A type of weather forecast", "A single type of tree", "A country's government"] },
            { kind: "mc", question: "What two things does a tropical rainforest need?", correct: ["High temperatures and very heavy rainfall"], distractors: ["Low temperatures and little rainfall", "High temperatures and little rainfall", "Low temperatures and heavy rainfall"] },
            { kind: "short", question: "Name the layer of the rainforest made up of the very tallest trees.", answers: ["the emergent layer", "emergent layer"] },
            { kind: "match", question: "Match each rainforest layer to its description.", pairs: [["Emergent layer", "the very tallest trees, above everything else"], ["Canopy", "a dense layer of treetops that blocks most sunlight"], ["Forest floor", "the dark ground layer, with little sunlight"]] },
            { kind: "order", question: "Order these rainforest layers from top to bottom.", items: ["emergent layer", "canopy", "understory", "forest floor"] },
          ],
          worksheet: [
            { text: "Name the two main conditions a tropical rainforest needs.", type: "short", answer: "high temperatures and very heavy rainfall" },
            { text: "Name the rainforest layer directly below the emergent layer.", type: "short", answer: "the canopy" },
            { text: "Explain why the forest floor of a rainforest often has few plants growing on it.", type: "extended", answer: "A good answer explains that the dense canopy above blocks most of the sunlight from reaching the forest floor, so very little light is left for plants to grow there." },
            { text: "Explain why rainforests are considered so important, even though they cover only a small percentage of the Earth's land.", type: "extended", answer: "A good answer explains that despite their relatively small land area, rainforests are home to an extraordinary proportion of the world's plant and animal species, making them extremely important for biodiversity." },
          ],
        },
        {
          slug: "desert-biomes",
          title: "Desert biomes",
          pupilLessonOutcome: "I can describe the key characteristics of a desert biome and explain how living things survive there.",
          keyLearningPoints: [
            "A desert is a biome that receives very little rainfall, usually less than 250mm per year, making it a very dry environment.",
            "Not all deserts are hot; some, like the Gobi Desert and Antarctica, are cold deserts, because 'desert' is defined by low rainfall, not temperature.",
            "Hot deserts, like the Sahara, can have huge temperature swings, extremely hot during the day and surprisingly cold at night, because dry air and lack of cloud cover let heat escape quickly after sunset.",
            "Plants and animals in deserts have adapted to survive with very little water, such as cacti storing water in thick stems, and animals being active at night to avoid daytime heat.",
          ],
          keywords: [
            { keyword: "desert", description: "A biome that receives very little rainfall, making it a very dry environment." },
            { keyword: "adaptation", description: "A feature or behaviour that helps a living thing survive in its particular environment." },
            { keyword: "nocturnal", description: "Active mainly at night, and resting during the day." },
          ],
          misconceptions: [
            { misconception: "Pupils think all deserts are hot, sandy places.", response: "Explain that a desert is defined by very low rainfall, not by temperature or sand; some deserts, like the Gobi Desert in Asia or even Antarctica, are extremely cold, because 'desert' just means very dry." },
            { misconception: "Pupils think deserts are always hot, even at night, because they imagine constant scorching heat.", response: "Explain that hot deserts often have huge temperature swings; dry air and clear skies let heat escape quickly once the Sun sets, so nights in a hot desert can actually become very cold." },
          ],
          teacherTips: [
            "Introduce the Gobi Desert or Antarctica early to challenge the assumption that all deserts are hot and sandy, since this is one of the most common and persistent misconceptions about deserts.",
            "Use specific, memorable animal and plant adaptations (camels' humps storing fat, cacti storing water, nocturnal animals like foxes) to make the idea of adaptation concrete and vivid.",
          ],
          transcript:
            "Hello! Today we're exploring desert biomes, and finding out how plants and animals manage to survive in such a challenging environment.\n\nWhat actually makes a desert a desert? It's not sand, and it's not heat. A desert is defined simply by how little rain it gets, usually less than 250 millimetres of rainfall a year, an extremely small amount compared with most other places. A desert is simply a very dry place.\n\nThis means not all deserts are hot. Most people picture the Sahara Desert in Africa, which is indeed hot and sandy. But some deserts are actually cold, the Gobi Desert in Asia has freezing winters, and even Antarctica, covered in ice, technically counts as a desert, because it receives so little precipitation.\n\nLet's focus on hot deserts, like the Sahara, for a moment. You might assume they stay scorching hot all the time, day and night. But actually, hot deserts often have huge swings in temperature between day and night. During the day, temperatures can soar incredibly high, with barely any cloud cover to block the Sun's heat. But once the Sun sets, that same lack of cloud cover means heat escapes back into the sky very quickly, and temperatures can drop dramatically, sometimes even close to freezing overnight.\n\nLiving in a desert, whether hot or cold, is a huge challenge, especially finding enough water. Plants and animals that live there have developed remarkable adaptations, special features or behaviours, that help them survive. Cacti, for example, have thick, fleshy stems that store water for long periods between rare rainfalls, and sharp spines instead of leaves to reduce water loss. Many desert animals, like foxes and owls, are nocturnal, meaning they rest during the hot day and become active at night, when temperatures are cooler and safer to move around in.\n\nA common mistake is assuming all deserts are hot and sandy. Remember, the defining feature of a desert is low rainfall, not temperature.\n\nNow you'll investigate some remarkable plant and animal adaptations found in desert environments.",
          starterQuiz: [
            { kind: "mc", question: "What is a biome?", correct: ["A large natural area with a particular climate and its own plants and animals"], distractors: ["A type of soil", "A country", "A season"] },
            { kind: "mc", question: "Which biome is found near the Equator with heavy rainfall all year round?", correct: ["Tropical rainforest"], distractors: ["Desert", "Polar", "Temperate"] },
            { kind: "short", question: "What does 'adapted' mean?", answers: ["having features suited to survive in a particular environment", "suited to living somewhere"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What defines a desert biome?", correct: ["Very low rainfall"], distractors: ["High temperature", "Sandy ground", "Lack of animals"] },
            { kind: "mc", question: "Which of these is a cold desert?", correct: ["The Gobi Desert"], distractors: ["The Sahara Desert", "The Amazon rainforest", "A tropical rainforest"] },
            { kind: "short", question: "What does 'nocturnal' mean?", answers: ["active mainly at night, resting during the day"] },
            { kind: "match", question: "Match each desert adaptation to the reason it helps survival.", pairs: [["A cactus's thick, fleshy stem", "stores water for long periods between rainfall"], ["An animal being nocturnal", "avoids the extreme heat of the day"], ["A cactus's spines instead of leaves", "reduces water loss"]] },
            { kind: "order", question: "Order these temperatures across one day in a hot desert, from lowest to highest.", items: ["night temperature", "sunrise temperature", "midday temperature"] },
          ],
          worksheet: [
            { text: "What is the definition of a desert, in terms of rainfall?", type: "short", answer: "a biome that receives very little rainfall, usually less than 250mm a year" },
            { text: "Name one cold desert.", type: "short", answer: "the Gobi Desert, or Antarctica" },
            { text: "Explain why hot deserts can become very cold at night.", type: "extended", answer: "A good answer explains that dry air and lack of cloud cover let the day's heat escape quickly into the sky once the Sun sets, causing temperatures to drop sharply overnight." },
            { text: "Describe one adaptation that helps a desert plant or animal survive, and explain how it helps.", type: "extended", answer: "A good answer describes a specific adaptation, such as a cactus storing water in its stem to survive long dry periods, or an animal being nocturnal to avoid the extreme heat of the day, and explains how that adaptation helps it survive with little water or extreme temperatures." },
          ],
        },
      ],
    },
  ],
};
