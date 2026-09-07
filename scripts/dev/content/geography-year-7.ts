import type { SubjectYearSpec } from "./types";

export const geographyYear7: SubjectYearSpec = {
  subject: { slug: "geography", title: "Geography" },
  programme: {
    sequenceSlug: "geography-secondary",
    yearGroup: 7,
    keyStage: "ks3",
    phase: "secondary",
    title: "Geography — Year 7",
  },
  units: [
    {
      slug: "weather-and-climate",
      title: "Weather and climate",
      description:
        "Pupils learn the difference between weather and climate, how weather is measured, and the key features of the UK's climate.",
      whyThisWhyNow:
        "Weather and climate are ideas pupils meet constantly outside school, but the two words are often confused. Untangling them early gives pupils accurate scientific vocabulary they will need for climate and environmental topics throughout secondary geography.",
      priorKnowledge: [
        "Pupils know that weather can be sunny, rainy, windy, cloudy or snowy, and that it changes from day to day.",
        "Pupils have used simple instruments, such as a thermometer, to measure temperature.",
        "Pupils know that the UK has four seasons: spring, summer, autumn and winter.",
      ],
      nationalCurriculum: [
        "Describe and understand key aspects of climate, including the water cycle and weather.",
        "Understand how weather is measured and recorded, and interpret weather data.",
        "Describe and understand key aspects of the UK's climate.",
        "Use geographical skills to interpret a range of sources of geographical data.",
      ],
      lessons: [
        {
          slug: "weather-vs-climate",
          title: "Weather vs climate",
          pupilLessonOutcome:
            "I can explain the difference between weather and climate, using examples.",
          keyLearningPoints: [
            "Weather describes the day-to-day (or even hour-to-hour) conditions of the atmosphere in one place, such as temperature, rainfall and wind.",
            "Climate describes the average weather conditions of a place over a long period, usually at least 30 years.",
            "A place can have unusual weather on a particular day without its overall climate changing.",
            "Climate is used to describe and compare typical conditions in different regions of the world, such as tropical, desert or polar climates.",
          ],
          keywords: [
            { keyword: "weather", description: "The day-to-day conditions of the atmosphere in one place, such as temperature, rainfall and wind." },
            { keyword: "climate", description: "The average weather conditions of a place measured over a long period, usually at least 30 years." },
            { keyword: "atmosphere", description: "The layer of gases surrounding the Earth, in which weather happens." },
          ],
          misconceptions: [
            { misconception: "Pupils use 'weather' and 'climate' interchangeably, for example saying 'the climate is rainy today'.", response: "Correct the phrasing directly: 'today' describes weather, a single day's conditions; climate is only correctly used when describing an average pattern over many years, e.g. 'the UK has a mild, rainy climate'." },
            { misconception: "Pupils think one unusually hot or cold day proves the climate of a place has changed.", response: "Explain that a single day, or even a single unusual season, is weather, not climate; climate only changes when average conditions shift over a long period, typically decades." },
          ],
          teacherTips: [
            "Use the well-known phrase 'climate is what you expect, weather is what you get' as a memorable summary pupils can return to.",
            "Give pairs of contrasting examples (e.g. 'it snowed in London yesterday' vs 'London has a temperate climate') and ask pupils to sort them into weather or climate statements.",
          ],
          transcript:
            "Welcome to Year 7 geography. We're starting with two words you've probably used your whole life, weather and climate, but which actually mean quite different things. Getting this distinction clear now will help you throughout this year and beyond.\n\nWeather describes the conditions of the atmosphere in one place, right now, or over a short period like today or this week. Weather includes things like temperature, whether it's raining or dry, how windy it is, and how cloudy the sky looks. Weather can change very quickly — it might be sunny in the morning and pouring with rain by the afternoon.\n\nClimate is different. Climate describes the average weather conditions of a place over a long period of time, usually measured over at least thirty years. So instead of describing what's happening today, climate describes the typical, expected pattern for that place across many years. For example, we say the UK has a temperate climate, meaning that, on average, over decades, it experiences mild temperatures and rainfall fairly evenly spread through the year, without extremes of very hot or very cold.\n\nHere's the really important part: weather and climate can seem to disagree with each other on any single day, and that's completely normal. Imagine it snows heavily in London one January day. That's a weather event — the conditions on that particular day. It does not mean London's climate has suddenly become a snowy, polar climate; London's overall climate, based on the average of many years, is still classed as temperate. A single unusual day, or even an unusual season, doesn't change the climate, because climate is about the long-term average, not any one moment.\n\nGeographers use climate to describe and compare different regions of the world. A tropical climate near the equator is hot and often wet all year round. A desert climate is very dry, with little rainfall, and can be extremely hot in the day. A polar climate near the North and South Poles is extremely cold, with very little precipitation.\n\nA common mistake is saying something like 'the climate is rainy today' — that sentence mixes the two ideas up; it should be 'the weather is rainy today', because climate cannot describe a single day. Over the next few lessons we'll look at how weather is actually measured, and then examine the UK's climate in more detail.",
          starterQuiz: [
            { kind: "mc", question: "Which of these describes what it is like outside right now?", correct: ["Weather"], distractors: ["A map", "A population", "A settlement"] },
            { kind: "mc", question: "Which instrument would you use to measure temperature?", correct: ["A thermometer"], distractors: ["A ruler", "A compass", "A microscope"] },
            { kind: "short", question: "Name the four seasons in the UK.", answers: ["spring, summer, autumn, winter", "spring summer autumn winter"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is climate?", correct: ["The average weather conditions of a place over a long period"], distractors: ["The weather conditions right now", "A single day's temperature", "The amount of rain in one storm"] },
            { kind: "mc", question: "Which of these are examples of weather, not climate? (select all that apply)", correct: ["It is raining in Leeds today", "There was a heatwave last week"], distractors: ["The UK has a temperate climate", "Deserts are typically dry all year"] },
            { kind: "short", question: "Over how many years is climate usually measured?", answers: ["30", "at least 30", "30 years"] },
            { kind: "match", question: "Match each statement to whether it describes weather or climate.", pairs: [["It snowed in Manchester yesterday", "Weather"], ["The UK has mild temperatures on average over many years", "Climate"], ["It is windy this afternoon", "Weather"]] },
            { kind: "order", question: "Order these from shortest to longest timescale: today's weather, this week's weather, this season, a place's climate (30+ years).", items: ["today's weather", "this week's weather", "this season", "a place's climate (30+ years)"] },
          ],
          worksheet: [
            { text: "Define 'weather' in your own words.", type: "short", answer: "The day-to-day conditions of the atmosphere in one place, such as temperature, rainfall and wind." },
            { text: "Define 'climate' in your own words.", type: "short", answer: "The average weather conditions of a place measured over a long period, usually at least 30 years." },
            { text: "Explain why one very hot day in the UK does not mean the UK's climate has changed.", type: "extended", answer: "A good answer explains that one hot day is a short-term weather event, while climate is the average of conditions over at least 30 years, so a single day cannot shift that long-term average." },
            { text: "A tourist says 'I visited the Sahara Desert and it rained, so the desert doesn't really have a dry climate.' Explain what is wrong with this reasoning.", type: "extended", answer: "A good answer explains that one rainy day is weather, not climate, and that the desert's climate is defined by its average conditions over many years, which remain dry overall despite an occasional rainy day." },
          ],
        },
        {
          slug: "measuring-weather",
          title: "Measuring weather",
          pupilLessonOutcome:
            "I can name key weather instruments and explain what each one measures.",
          keyLearningPoints: [
            "A thermometer measures air temperature, usually in degrees Celsius.",
            "A rain gauge measures the amount of rainfall collected over a period of time, usually in millimetres.",
            "An anemometer measures wind speed, while a wind vane shows wind direction.",
            "Meteorologists use data from many weather stations to build a picture of the weather across a wide area and to help forecast future weather.",
          ],
          keywords: [
            { keyword: "rain gauge", description: "An instrument that collects and measures the amount of rainfall over a period of time." },
            { keyword: "anemometer", description: "An instrument that measures wind speed." },
            { keyword: "meteorologist", description: "A scientist who studies and forecasts weather." },
          ],
          misconceptions: [
            { misconception: "Pupils confuse an anemometer (which measures wind speed) with a wind vane (which shows wind direction).", response: "Give a clear memory hook: an anemometer has spinning cups and counts how fast they spin for speed, while a wind vane is an arrow that simply points to show which direction the wind is blowing from." },
            { misconception: "Pupils think a single weather station's reading tells us the weather for an entire country.", response: "Explain that weather can vary significantly even within short distances, so meteorologists combine readings from many weather stations spread across an area to build an accurate, wider picture." },
          ],
          teacherTips: [
            "If possible, show real (or photographed) examples of each instrument, since their appearance makes the terms much easier to recall than a definition alone.",
            "Link units explicitly to each instrument (degrees Celsius for temperature, millimetres for rainfall, mph or km/h for wind speed) since exam-style questions often test whether pupils know the correct unit.",
          ],
          transcript:
            "In our last lesson we distinguished weather from climate. Today we look at how weather is actually measured, using specific instruments designed for each type of measurement.\n\nLet's start with something you probably already know: temperature is measured using a thermometer, usually giving a reading in degrees Celsius. A simple, familiar instrument, but an essential one — temperature affects almost everything else about the weather.\n\nNext is rainfall. To measure how much rain has fallen over a period of time, meteorologists use a rain gauge. This is essentially an open container with markings, left outside to collect rainwater; the depth of water collected, usually measured in millimetres, tells us how much rain fell in that time. A rain gauge doesn't tell us how hard it rained at any one moment, but it does tell us the total amount that fell.\n\nWind is measured using two separate instruments, because wind actually has two different properties we care about: how fast it's blowing, and which direction it's coming from. To measure wind speed, we use an anemometer. This instrument usually has several small cups mounted on arms that spin around in the wind — the faster the wind, the faster the cups spin, and this spinning rate is converted into a speed reading. To measure wind direction, we use a wind vane, sometimes called a weathervane. This is essentially an arrow, balanced so it can turn freely, which points into the wind, showing us the direction the wind is blowing from.\n\nAll of this data — temperature, rainfall, wind speed and wind direction — is collected at weather stations positioned across a country or region. No single weather station can tell us about the weather everywhere, because conditions can be quite different even a short distance away, for example between a coastal town and somewhere further inland. Meteorologists, scientists who study weather, combine readings from many weather stations to build an accurate picture of current weather conditions across a wide area, and use patterns in this data to help forecast what the weather is likely to do next.\n\nA common mix-up is confusing the anemometer and the wind vane. Remember: the anemometer's spinning cups measure speed, while the wind vane's arrow points to show direction. Next lesson, we'll use ideas like these to explore the UK's climate specifically.",
          starterQuiz: [
            { kind: "mc", question: "What does weather describe?", correct: ["The day-to-day conditions of the atmosphere in one place"], distractors: ["The average conditions of a place over 30 years", "The shape of the land", "The number of people living somewhere"] },
            { kind: "mc", question: "What unit is temperature usually measured in?", correct: ["Degrees Celsius"], distractors: ["Millimetres", "Miles per hour", "Litres"] },
            { kind: "short", question: "True or false: climate describes the weather on a single day.", answers: ["false", "False"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What does an anemometer measure?", correct: ["Wind speed"], distractors: ["Wind direction", "Rainfall", "Temperature"] },
            { kind: "mc", question: "Which of these instruments measure a property of wind? (select all that apply)", correct: ["Anemometer", "Wind vane"], distractors: ["Rain gauge", "Thermometer"] },
            { kind: "short", question: "What unit is rainfall usually measured in?", answers: ["millimetres", "mm"] },
            { kind: "match", question: "Match each instrument to what it measures.", pairs: [["Thermometer", "Temperature"], ["Rain gauge", "Rainfall"], ["Wind vane", "Wind direction"]] },
            { kind: "order", question: "Order these steps for how meteorologists build a weather picture: instruments at weather stations take readings, data is collected from many stations across an area, meteorologists combine the data, meteorologists use patterns to forecast future weather.", items: ["instruments at weather stations take readings", "data is collected from many stations across an area", "meteorologists combine the data", "meteorologists use patterns to forecast future weather"] },
          ],
          worksheet: [
            { text: "Name the instrument used to measure rainfall.", type: "short", answer: "a rain gauge" },
            { text: "Name the instrument used to measure wind speed.", type: "short", answer: "an anemometer" },
            { text: "Explain the difference between what an anemometer and a wind vane each measure.", type: "extended", answer: "A good answer states that an anemometer measures wind speed (using spinning cups), while a wind vane shows wind direction (using a pointing arrow) — they measure different properties of wind." },
            { text: "Explain why meteorologists use readings from many weather stations rather than just one.", type: "extended", answer: "A good answer explains that weather can vary between nearby places (e.g. coast vs inland), so combining readings from many stations gives a more accurate picture of weather across a wider area." },
          ],
        },
        {
          slug: "the-uks-climate",
          title: "The UK's climate",
          pupilLessonOutcome:
            "I can describe the key features of the UK's climate and explain what causes them.",
          keyLearningPoints: [
            "The UK has a temperate maritime climate, meaning mild temperatures and rainfall spread fairly evenly throughout the year, without extremes.",
            "The UK's climate is strongly influenced by the sea, because being an island surrounded by ocean keeps temperatures milder than places at a similar latitude but further from the sea.",
            "The North Atlantic Drift, a warm ocean current, carries warm water from the tropics towards the UK, helping to warm the west coast in particular.",
            "There are still noticeable differences within the UK's climate, such as the west generally being wetter than the east, and the north generally being cooler than the south.",
          ],
          keywords: [
            { keyword: "temperate", description: "A climate type with mild temperatures, avoiding extremes of very hot or very cold." },
            { keyword: "maritime", description: "Influenced by the sea; a maritime climate is affected by its closeness to an ocean." },
            { keyword: "North Atlantic Drift", description: "A warm ocean current that carries warm water from the tropics towards the UK, helping to warm its climate." },
          ],
          misconceptions: [
            { misconception: "Pupils think the UK has the same weather everywhere at the same time because it is described as having 'one climate'.", response: "Clarify that 'temperate maritime' describes the UK's overall climate type, but there are still real regional differences within it, such as the west typically being wetter than the east, and the north cooler than the south." },
            { misconception: "Pupils think the UK's climate is mild simply because of its latitude (how far north or south it is), ignoring the sea's influence.", response: "Point out that other places at a similar latitude to the UK, further from the ocean, can have far colder winters and hotter summers; it is the surrounding sea and the North Atlantic Drift that keep the UK notably milder than its latitude alone would suggest." },
          ],
          teacherTips: [
            "Use a simple world map showing the North Atlantic Drift's path from the tropics to the UK, so pupils can visualise warm water physically travelling towards Britain.",
            "Compare the UK's climate briefly to a country at a similar latitude but in the middle of a large continent (such as parts of central Canada) to show how much the sea moderates temperature.",
          ],
          transcript:
            "Over the last two lessons we've learned the difference between weather and climate, and how weather is measured. Today we apply this to describe the UK's own climate, and explain what causes its particular features.\n\nThe UK's climate is described as temperate maritime. Temperate means mild — the UK doesn't typically experience extremes of very hot summers or very cold, harsh winters. Maritime means influenced by the sea, and this is the key to understanding why the UK's climate is the way it is.\n\nThe UK is an island, surrounded by ocean on all sides. Water heats up and cools down much more slowly than land does. In summer, the surrounding sea stays relatively cool and helps keep the UK from getting extremely hot. In winter, the sea holds onto its warmth longer than land would, and that warmth is carried over the UK, keeping winters milder than they would otherwise be. This is why the UK avoids the extreme heat or bitterly cold winters of countries at a similar distance from the equator but located inland, far from any moderating sea.\n\nAn extra factor makes the UK's climate even milder: the North Atlantic Drift, a current of warm ocean water flowing from near the tropics, across the Atlantic, and past the UK, particularly affecting the west coast. This warm current raises air temperatures above the sea, and that warmer air is carried over the UK by the prevailing wind, adding further warmth, especially in winter.\n\nEven so, there are still real differences from place to place within the UK. Generally, the west is wetter than the east, partly because weather systems arriving from the Atlantic drop much of their rain as they rise over hills there. Generally, the north is cooler than the south, since it is further from the equator and receives slightly less direct sunlight across the year.\n\nA common mistake is thinking the whole UK has identical weather all the time just because it shares one climate type. In reality, 'temperate maritime' describes the overall pattern, but real regional differences exist across the country. This brings us to the end of our weather and climate unit; next unit, we turn to population and settlement.",
          starterQuiz: [
            { kind: "mc", question: "What does an anemometer measure?", correct: ["Wind speed"], distractors: ["Wind direction", "Temperature", "Rainfall"] },
            { kind: "mc", question: "What instrument measures rainfall?", correct: ["A rain gauge"], distractors: ["A thermometer", "A wind vane", "An anemometer"] },
            { kind: "short", question: "What is the difference between weather and climate, in one sentence?", answers: ["weather is short-term daily conditions, climate is the long-term average", "weather is day to day, climate is the average over many years"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "How would you best describe the UK's climate?", correct: ["Temperate maritime"], distractors: ["Tropical", "Polar", "Desert"] },
            { kind: "mc", question: "Which of these help explain why the UK's climate is mild? (select all that apply)", correct: ["The UK is surrounded by sea, which heats and cools slowly", "The North Atlantic Drift carries warm water towards the UK"], distractors: ["The UK is located exactly on the equator", "The UK has no rainfall"] },
            { kind: "short", question: "Which part of the UK, west or east, is generally wetter?", answers: ["west", "the west"] },
            { kind: "match", question: "Match each term to its correct meaning.", pairs: [["Temperate", "Mild, without extremes of hot or cold"], ["Maritime", "Influenced by the sea"], ["North Atlantic Drift", "A warm ocean current flowing towards the UK"]] },
            { kind: "order", question: "Order these statements to explain why UK winters are milder than inland places at a similar latitude: the UK is surrounded by ocean, the sea holds onto warmth longer than land, this warmth is carried over the UK, the UK's winters stay milder than places further from the sea.", items: ["the UK is surrounded by ocean", "the sea holds onto warmth longer than land", "this warmth is carried over the UK", "the UK's winters stay milder than places further from the sea"] },
          ],
          worksheet: [
            { text: "What term describes the UK's climate?", type: "short", answer: "temperate maritime" },
            { text: "Name the warm ocean current that helps warm the UK's climate.", type: "short", answer: "the North Atlantic Drift" },
            { text: "Explain why being surrounded by the sea makes the UK's climate milder than a similar-latitude location in the middle of a large continent.", type: "extended", answer: "A good answer explains that the sea heats up and cools down more slowly than land, so it keeps summers cooler and winters milder for the surrounding island, unlike inland areas which heat and cool more extremely." },
            { text: "Describe one regional difference in climate found within the UK.", type: "extended", answer: "A good answer states a real regional pattern, e.g. the west is generally wetter than the east because Atlantic weather systems drop rain as they rise over western hills, or the north is generally cooler than the south." },
          ],
        },
      ],
    },
    {
      slug: "population-and-settlement",
      title: "Population and settlement",
      description:
        "Pupils learn how population is distributed unevenly around the world, why cities grow through urbanisation, and how settlements can be classified by size and function.",
      whyThisWhyNow:
        "Having studied physical geography through weather and climate, pupils now turn to human geography, learning why people live where they do. This gives pupils the foundations for later topics on cities, migration and development.",
      priorKnowledge: [
        "Pupils know that people live in different types of places, such as villages, towns and cities.",
        "Pupils understand that a map can show where places are located.",
        "Pupils know that the world's population is very large and made up of many different countries.",
      ],
      nationalCurriculum: [
        "Human geography relating to population and urbanisation.",
        "Understand how human and physical processes interact to influence and change landscapes, environments and the climate.",
        "Use geographical skills to interpret maps and data about where people live.",
        "Understand key processes in human geography relating to settlement.",
      ],
      lessons: [
        {
          slug: "population-distribution",
          title: "Population distribution",
          pupilLessonOutcome:
            "I can describe how population is distributed unevenly around the world and explain the physical and human factors that cause this.",
          keyLearningPoints: [
            "Population distribution describes how people are spread out across an area; it is not even, with some places densely populated and others sparsely populated.",
            "Physical factors affecting population distribution include climate, relief (the shape and height of the land), and access to water and fertile soil.",
            "Human factors affecting population distribution include job opportunities, transport links, and government policy.",
            "Areas with a harsh climate, very high mountains, or a lack of fresh water tend to have low population density.",
          ],
          keywords: [
            { keyword: "population distribution", description: "How people are spread out across an area or the world." },
            { keyword: "population density", description: "The number of people living in a given area, usually measured per square kilometre." },
            { keyword: "relief", description: "The shape and height of the land, including features like mountains, hills and flat plains." },
          ],
          misconceptions: [
            { misconception: "Pupils think population is spread roughly evenly across the world, since the total population is 'shared' across all countries.", response: "Show a world population density map and point out huge empty-looking areas (like the Sahara or Antarctica) next to densely packed regions (like parts of South East Asia), making clear that distribution is highly uneven." },
            { misconception: "Pupils think only physical factors (like climate) explain where people live, ignoring human factors.", response: "Give a clear example, such as a city growing around a good transport hub or job opportunities in a particular region, to show that human factors are just as important as physical ones in explaining population distribution." },
          ],
          teacherTips: [
            "Use a world population density map as the central resource for this lesson, asking pupils to identify and describe patterns before you explain the causes.",
            "Sort factors into a 'physical' and 'human' table together as a class, reinforcing the two-category distinction pupils will need to use in later explanations.",
          ],
          transcript:
            "Welcome to our new unit on population and settlement. Today we look at population distribution — how people are spread out across the world, and why that spread is so uneven.\n\nIf population were shared out evenly, you'd expect roughly similar numbers of people living in any given area of land, wherever you looked. But that's not what actually happens. Some parts of the world, like parts of South East Asia and Western Europe, are extremely densely populated, packed with people. Other huge areas, like much of the Sahara Desert, the Amazon rainforest, or Antarctica, have very few people living there at all, sometimes almost none. We describe this uneven spread using the term population distribution.\n\nWhy is population spread so unevenly? Geographers group the reasons into physical factors and human factors. Physical factors are things related to the natural environment. Climate matters hugely — very cold polar regions or very hot, dry deserts tend to have low population density, because they make growing food and daily survival much harder. Relief, meaning the shape and height of the land, matters too — very high, steep mountainous areas are difficult to build on and farm, so they also tend to have fewer people. Access to fresh water and fertile soil for farming also strongly influences where people choose, or are able, to settle; areas near rivers with good farmland have historically attracted large populations.\n\nHuman factors relate to people's decisions and activities, rather than the natural environment. Job opportunities draw people towards cities and industrial areas. Good transport links, like major roads, railways or ports, make an area easier to live in and trade from. Government policy can also shape distribution — for example, a government might invest heavily in developing a region, encouraging people to move there.\n\nIt's important to remember that physical and human factors often work together, not separately. A place might have excellent fertile land, a physical factor, but if it also has poor transport links, a human factor, fewer people may settle there than you'd otherwise expect.\n\nA common mistake is assuming population is roughly evenly shared across the world just because there are so many people alive today — it absolutely is not; some regions are almost empty while others are extremely crowded. Next lesson, we'll look at a related process: urbanisation, and why cities in particular have grown so quickly.",
          starterQuiz: [
            { kind: "mc", question: "What term describes the average weather conditions of a place over 30+ years?", correct: ["Climate"], distractors: ["Weather", "Population", "Relief"] },
            { kind: "mc", question: "Which of these is a type of place people live in?", correct: ["A city"], distractors: ["A rain gauge", "An anemometer", "A trade route"] },
            { kind: "short", question: "Name one physical feature of land, such as a mountain or a plain.", answers: ["mountain", "a mountain", "plain", "a plain", "hill", "a hill"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What does 'population distribution' mean?", correct: ["How people are spread out across an area"], distractors: ["The total number of people in a country", "The average age of a population", "The number of cities in a country"] },
            { kind: "mc", question: "Which of these are physical factors affecting population distribution? (select all that apply)", correct: ["Climate", "Relief (the shape and height of land)"], distractors: ["Job opportunities", "Government policy"] },
            { kind: "short", question: "What term describes the number of people living in a given area, usually per square kilometre?", answers: ["population density"] },
            { kind: "match", question: "Match each factor to whether it is physical or human.", pairs: [["Climate", "Physical factor"], ["Job opportunities", "Human factor"], ["Access to fresh water", "Physical factor"]] },
            { kind: "order", question: "Order these areas from most densely populated to least densely populated, based on typical patterns: a fertile river valley with good transport links, a temperate coastal city, a very high mountain range, the middle of a large hot desert.", items: ["a fertile river valley with good transport links", "a temperate coastal city", "a very high mountain range", "the middle of a large hot desert"] },
          ],
          worksheet: [
            { text: "Define 'population distribution' in your own words.", type: "short", answer: "How people are spread out unevenly across an area or the world." },
            { text: "Name one human factor that can attract people to live in an area.", type: "short", answer: "Job opportunities (or good transport links, or government investment)." },
            { text: "Explain why areas with a very harsh climate tend to have low population density.", type: "extended", answer: "A good answer explains that extreme heat, cold or dryness makes growing food and daily survival difficult, so fewer people are able to live there, giving low population density." },
            { text: "Explain, using an example, how physical and human factors can work together to influence where people live.", type: "extended", answer: "A good answer gives an example combining both, e.g. an area with fertile land (physical) that also develops good transport links or job opportunities (human), attracting more people than either factor alone would." },
          ],
        },
        {
          slug: "urbanisation",
          title: "Urbanisation",
          pupilLessonOutcome:
            "I can define urbanisation and explain the main reasons why cities grow.",
          keyLearningPoints: [
            "Urbanisation is the process by which an increasing proportion of a country's population comes to live in towns and cities.",
            "Rural-to-urban migration, people moving from the countryside to cities, is a major cause of urbanisation, often driven by the search for jobs and better services.",
            "Natural increase, where the number of births in a city is greater than the number of deaths, also contributes to urban population growth.",
            "Urbanisation is happening especially fast in many developing countries, whereas many developed countries urbanised earlier and more gradually.",
          ],
          keywords: [
            { keyword: "urbanisation", description: "The process by which an increasing proportion of a country's population comes to live in towns and cities." },
            { keyword: "rural-to-urban migration", description: "The movement of people from the countryside (rural areas) to towns and cities (urban areas)." },
            { keyword: "natural increase", description: "Population growth that happens when the number of births in an area is greater than the number of deaths." },
          ],
          misconceptions: [
            { misconception: "Pupils think urbanisation simply means 'a city getting bigger', including through any cause.", response: "Clarify that urbanisation specifically refers to the proportion of a country's population living in urban areas increasing, most often driven by rural-to-urban migration, not just any general population growth." },
            { misconception: "Pupils think everyone who moves to a city does so for exactly the same reason.", response: "Give a range of real push and pull factors — such as few jobs in rural areas pushing people out, and better healthcare, education or wages in cities pulling people in — to show migration decisions involve multiple factors, not a single cause." },
          ],
          teacherTips: [
            "Introduce the ideas of 'push factors' (reasons people leave rural areas) and 'pull factors' (reasons cities attract people) as a simple framework pupils can apply to real examples.",
            "Use a specific, real example of a fast-urbanising city (such as one in South East Asia or sub-Saharan Africa) to make the scale of change concrete rather than abstract.",
          ],
          transcript:
            "Last lesson we looked at why population is distributed unevenly around the world. Today we focus on one of the biggest trends changing that distribution: urbanisation.\n\nUrbanisation is the process by which an increasing proportion of a country's population comes to live in towns and cities, rather than in the countryside. It's important to notice this is about proportion — the share of people living in urban areas compared to rural areas — not simply a city getting a bit bigger for any reason at all.\n\nOne of the biggest causes of urbanisation is rural-to-urban migration: people moving from the countryside into towns and cities. Why do people move? Geographers often describe this using push factors and pull factors. Push factors are reasons that push people to leave rural areas — for example, a shortage of farming jobs, low wages in agriculture, or a lack of services like good schools or hospitals in the countryside. Pull factors are reasons that pull people towards cities instead — for example, more job opportunities in industry and services, better wages, and easier access to healthcare, education and entertainment. When push and pull factors combine, large numbers of people can move from rural to urban areas within just a few years.\n\nUrbanisation isn't only caused by migration, though. Natural increase also plays a role: this happens when the number of births in a city is greater than the number of deaths there, so the city's population grows even without anyone moving in from elsewhere. In many rapidly growing cities, both rural-to-urban migration and natural increase are happening at the same time, which is why some cities have grown so dramatically in a short period.\n\nUrbanisation is happening at very different speeds around the world today. Many developing countries, particularly in parts of Africa and Asia, are urbanising extremely quickly right now, with cities sometimes doubling in population within just a couple of decades. Many developed countries, including the UK, urbanised earlier, mostly during the Industrial Revolution centuries ago, and their rate of urbanisation today is much slower and more gradual by comparison.\n\nA common mistake is thinking urbanisation just means 'a city getting bigger' for any reason — remember it specifically refers to a growing proportion of the population living in urban rather than rural areas. Next lesson, we'll look more closely at how settlements themselves can be classified by their size and function.",
          starterQuiz: [
            { kind: "mc", question: "What does 'population distribution' describe?", correct: ["How people are spread out across an area"], distractors: ["The average temperature of a place", "The total number of countries in the world", "The height of the land"] },
            { kind: "mc", question: "Which of these is a physical factor affecting where people live?", correct: ["Climate"], distractors: ["Job opportunities", "Transport links", "Government policy"] },
            { kind: "short", question: "What term describes the number of people living in a given area, usually per square kilometre?", answers: ["population density"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is urbanisation?", correct: ["An increasing proportion of a country's population living in towns and cities"], distractors: ["A decrease in a country's total population", "The building of new roads in the countryside", "The average weather in a city"] },
            { kind: "mc", question: "Which of these contribute to urban population growth? (select all that apply)", correct: ["Rural-to-urban migration", "Natural increase (more births than deaths)"], distractors: ["A decrease in city job opportunities", "People moving from cities to the countryside"] },
            { kind: "short", question: "What term describes people moving from the countryside to cities?", answers: ["rural-to-urban migration"] },
            { kind: "match", question: "Match each term to its correct description.", pairs: [["Push factor", "A reason people leave rural areas"], ["Pull factor", "A reason people are attracted to cities"], ["Natural increase", "More births than deaths in an area"]] },
            { kind: "order", question: "Order these steps to explain rural-to-urban migration: a rural area has few jobs and services, a city offers more jobs and better services, a family decides to move from the rural area to the city, the city's urban population grows.", items: ["a rural area has few jobs and services", "a city offers more jobs and better services", "a family decides to move from the rural area to the city", "the city's urban population grows"] },
          ],
          worksheet: [
            { text: "Define 'urbanisation' in your own words.", type: "short", answer: "The process by which an increasing proportion of a country's population comes to live in towns and cities." },
            { text: "Give one example of a push factor and one example of a pull factor in rural-to-urban migration.", type: "short", answer: "Push factor: few jobs or poor services in rural areas. Pull factor: more jobs, better wages or services in cities." },
            { text: "Explain how natural increase can cause a city's population to grow, even without migration.", type: "extended", answer: "A good answer explains that natural increase happens when the number of births in a city is greater than the number of deaths, so the population grows from within, without anyone moving in." },
            { text: "Explain why urbanisation is happening faster in many developing countries today than in the UK.", type: "extended", answer: "A good answer explains that many developing countries are urbanising rapidly now due to strong rural-to-urban migration and natural increase, while the UK urbanised earlier and more gradually, mainly during the Industrial Revolution, so its current rate is slower." },
          ],
        },
        {
          slug: "settlement-types-and-hierarchy",
          title: "Settlement types and the settlement hierarchy",
          pupilLessonOutcome:
            "I can classify settlements by size and explain the settlement hierarchy.",
          keyLearningPoints: [
            "A settlement is any place where people live, from a single isolated farm to a huge city.",
            "Settlements are commonly classified by size, from smallest to largest: hamlet, village, town, city.",
            "The settlement hierarchy arranges settlement types by size and the range of services they offer, with fewer, larger settlements offering more services at the top.",
            "Larger settlements generally have a bigger sphere of influence, meaning people travel further to reach the range of services they offer.",
          ],
          keywords: [
            { keyword: "settlement", description: "Any place where people live, ranging in size from a single isolated dwelling to a large city." },
            { keyword: "settlement hierarchy", description: "The arrangement of settlement types by size and the range of services they provide, from small hamlets to large cities." },
            { keyword: "sphere of influence", description: "The area around a settlement from which people travel to use its services." },
          ],
          misconceptions: [
            { misconception: "Pupils think settlement size is only about population number, with no connection to services offered.", response: "Explain that settlement size and the range of services available are closely linked: larger settlements like cities typically offer specialist services (like large hospitals or universities) that a small village cannot support, because they need a larger population to make them viable." },
            { misconception: "Pupils think every settlement neatly fits one clear category with no overlap.", response: "Acknowledge that the boundaries between hamlet, village, town and city are not fixed rules — there is no exact population cut-off — and geographers use these categories as a useful guide rather than a strict, universal measurement." },
          ],
          teacherTips: [
            "Draw the settlement hierarchy as a pyramid, with hamlets at the wide base (many, small) and cities at the narrow top (few, large), mirroring the pattern of services available at each level.",
            "Ask pupils to sort local or well-known settlement examples into hamlet, village, town or city, discussing what evidence (population, services, size) supports their choice.",
          ],
          transcript:
            "Over the last two lessons we've looked at where people live and why cities grow through urbanisation. Today, in our final lesson of this unit, we look at how geographers classify different types of settlement, and how these settlement types relate to each other.\n\nA settlement is simply any place where people live, from a single isolated farmhouse to a sprawling city of millions. Since 'settlement' covers such a huge range, geographers use a set of categories to classify them by size.\n\nFrom smallest to largest, the main categories are: a hamlet, a very small settlement of perhaps just a handful of houses, often without even a shop; a village, bigger than a hamlet, usually with a small number of services like a shop, a school, and perhaps a church; a town, larger still, with several shops, secondary schools, and often a small hospital; and finally a city, the largest type, with specialist services such as a large hospital, a university, and major shopping and business districts.\n\nThese categories, arranged in order of size, form what geographers call the settlement hierarchy. Moving up the hierarchy from hamlet to city, settlements get larger in population, but crucially, they also offer a wider range of services. This connection matters: a specialist service like a large hospital or a university needs a large number of people nearby to make it worth providing, which is exactly why you find such services in cities and rarely in a small hamlet.\n\nThis pattern also affects a settlement's sphere of influence — the area from which people travel to use its services. A small village's shop might only draw customers from the immediate local area. But a large city's university or major hospital might draw people from an entire region, because people are willing to travel further for a service they can't get closer to home. Generally, the larger and more specialised the settlement, the larger its sphere of influence.\n\nA common mistake is thinking every settlement fits neatly into one category with a fixed population cut-off — these categories are useful guides rather than strict rules, and the boundary between a large village and a small town can be a matter of judgement. This ends our population and settlement unit; you should now be able to explain how and why population is distributed and organised as it is.",
          starterQuiz: [
            { kind: "mc", question: "What is urbanisation?", correct: ["An increasing proportion of a population living in towns and cities"], distractors: ["A decrease in city population", "The building of new farms", "A type of weather pattern"] },
            { kind: "mc", question: "Which of these is a reason people might move from the countryside to a city?", correct: ["Better job opportunities"], distractors: ["Cheaper farmland", "Fewer shops", "Lower population"] },
            { kind: "short", question: "What do we call the movement of people from rural to urban areas?", answers: ["rural-to-urban migration"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "Which is the correct order of settlement types from smallest to largest?", correct: ["Hamlet, village, town, city"], distractors: ["Village, hamlet, city, town", "City, town, village, hamlet", "Town, city, hamlet, village"] },
            { kind: "mc", question: "Which of these are typically found in a city but not a small hamlet? (select all that apply)", correct: ["A university", "A large hospital"], distractors: ["A single farmhouse", "No services at all"] },
            { kind: "short", question: "What term describes the area from which people travel to use a settlement's services?", answers: ["sphere of influence"] },
            { kind: "match", question: "Match each settlement type to a typical feature.", pairs: [["Hamlet", "A handful of houses, often no shop"], ["Village", "A shop, a school, perhaps a church"], ["City", "A university and a large hospital"]] },
            { kind: "order", question: "Order these settlements from smallest to largest in the settlement hierarchy: hamlet, village, town, city.", items: ["hamlet", "village", "town", "city"] },
          ],
          worksheet: [
            { text: "Define 'settlement' in your own words.", type: "short", answer: "Any place where people live, from a single isolated dwelling to a large city." },
            { text: "Name the four main settlement types in order from smallest to largest.", type: "short", answer: "Hamlet, village, town, city." },
            { text: "Explain why a large hospital is more likely to be found in a city than in a hamlet.", type: "extended", answer: "A good answer explains that a large hospital is a specialist service needing many people nearby to be viable, and only larger settlements like cities have a population big enough to support it." },
            { text: "Explain what is meant by a settlement's 'sphere of influence', using an example.", type: "extended", answer: "A good answer defines sphere of influence as the area people travel from to use a settlement's services, with an example such as people travelling a long distance to reach a city's university or large hospital, showing a large settlement has a wider sphere of influence than a small one." },
          ],
        },
      ],
    },
  ],
};
