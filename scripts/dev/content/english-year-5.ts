import type { SubjectYearSpec } from "./types";

export const englishYear5: SubjectYearSpec = {
  subject: { slug: "english", title: "English" },
  programme: {
    sequenceSlug: "english-primary",
    yearGroup: 5,
    keyStage: "ks2",
    phase: "primary",
    title: "English — Year 5",
  },
  units: [
    {
      slug: "writing-to-describe",
      title: "Writing to describe",
      description:
        "Pupils learn to build detailed, engaging descriptions using expanded noun phrases, figurative language, and techniques for creating a vivid setting.",
      whyThisWhyNow:
        "This unit equips pupils with the descriptive toolkit expected in Year 5 narrative writing, building on simple adjective use from Key Stage 1 towards the more deliberate, precise word choices needed for Year 6 and beyond.",
      priorKnowledge: [
        "Pupils can use adjectives to add detail to a noun, e.g. 'the tall tree'.",
        "Pupils can write simple sentences describing what they can see, hear or feel.",
        "Pupils know that a noun is a naming word for a person, place or thing.",
      ],
      nationalCurriculum: [
        "Describe settings, characters and atmosphere in narrative writing.",
        "Select vocabulary and grammatical structures that reflect what the writing requires.",
        "Use expanded noun phrases to convey complicated information concisely.",
      ],
      lessons: [
        {
          slug: "expanded-noun-phrases-for-description",
          title: "Building expanded noun phrases",
          pupilLessonOutcome: "I can build expanded noun phrases to add detail and interest to my descriptive writing.",
          keyLearningPoints: [
            "An expanded noun phrase adds extra description before and/or after a noun to make writing more detailed and interesting.",
            "We can expand a noun phrase by adding more than one adjective, e.g. 'the old, creaking gate'.",
            "We can also expand a noun phrase using a phrase after the noun, e.g. 'the gate, covered in ivy'.",
            "Commas are used to separate two or more adjectives that describe the same noun.",
          ],
          keywords: [
            { keyword: "noun phrase", description: "A group of words built around a noun, e.g. 'the dog' or 'the small, brown dog'." },
            { keyword: "expanded noun phrase", description: "A noun phrase made more detailed by adding extra describing words or a describing phrase." },
            { keyword: "adjective", description: "A word that describes a noun, e.g. 'ancient', 'gloomy', 'silver'." },
          ],
          misconceptions: [
            { misconception: "Pupils think that piling up as many adjectives as possible always makes writing better, e.g. 'the big, huge, enormous, giant castle'.", response: "Explain that using several adjectives with similar meanings is repetitive, not powerful; encourage choosing one or two precise, varied adjectives instead, e.g. 'the towering, crumbling castle'." },
            { misconception: "Pupils forget to use a comma between two adjectives before a noun, writing 'the dark cold cave' instead of 'the dark, cold cave'.", response: "Model reading the phrase aloud and pointing out the natural pause between the adjectives — that pause is shown in writing with a comma." },
          ],
          teacherTips: [
            "Build expanded noun phrases together on the whiteboard, starting with a bare noun and adding layers one at a time so pupils see the phrase grow.",
            "Encourage pupils to picture the object in their mind and ask 'what does it look, sound or feel like?' before choosing adjectives.",
          ],
          transcript:
            "Hello! Today we're learning how to make our descriptions more interesting by building expanded noun phrases.\n\nA noun phrase is simply a group of words built around a noun, a naming word for a person, place or thing. 'The door' is a noun phrase. It tells us what we're talking about, but it doesn't tell us very much.\n\nNow, if I add some adjectives, describing words, I can make that noun phrase far more interesting. 'The old, wooden door' tells us so much more than just 'the door'. This is called an expanded noun phrase, because we've expanded, or grown, the phrase with extra detail.\n\nNotice something important. When I use two adjectives before the noun, like 'old' and 'wooden', I put a comma between them. That comma shows the small pause your voice makes when you say the two describing words out loud. Try saying 'the old wooden door' without a pause — it sounds rushed. Say 'the old, wooden door' with a tiny pause, and it flows much better.\n\nWe can also expand a noun phrase by adding a describing phrase after the noun, instead of, or as well as, before it. For example: 'the door, creaking on rusty hinges'. This paints an even clearer picture in the reader's mind.\n\nLet's build one together. Start with the noun 'forest'. Add an adjective: 'the dark forest'. Add another: 'the dark, silent forest'. Now add a phrase after it: 'the dark, silent forest, stretching for miles'. Can you picture it far more clearly now than with just 'the forest'?\n\nHere's a mistake to avoid. Some writers think piling up lots of adjectives makes writing better, like 'the big, huge, enormous castle'. But 'big', 'huge' and 'enormous' all mean nearly the same thing, so this just sounds repetitive. It's much stronger to choose one or two precise, different adjectives, like 'the towering, crumbling castle', which gives the reader two separate pieces of information.\n\nNow you'll practise building your own expanded noun phrases to describe a setting.",
          starterQuiz: [
            { kind: "mc", question: "What is a noun?", correct: ["A naming word for a person, place or thing"], distractors: ["A describing word", "A word that shows an action", "A joining word"] },
            { kind: "mc", question: "Which of these is an adjective?", correct: ["gloomy"], distractors: ["running", "quickly", "castle"] },
            { kind: "short", question: "Write a noun phrase using the adjective 'tall' and the noun 'tree'.", answers: ["the tall tree", "tall tree"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is an expanded noun phrase?", correct: ["A noun phrase made more detailed with extra describing words or a phrase"], distractors: ["A noun phrase with no adjectives", "A sentence with a verb added", "A noun phrase shortened to one word"] },
            { kind: "mc", question: "Which sentence uses a correctly punctuated expanded noun phrase?", correct: ["The dark, silent forest stretched for miles."], distractors: ["The dark silent, forest stretched for miles.", "The dark silent forest, stretched for miles.", "The dark; silent forest stretched for miles."] },
            { kind: "short", question: "Add a comma in the correct place: 'the tall dusty bookshelf'", answers: ["the tall, dusty bookshelf"] },
            { kind: "match", question: "Match each noun to an expanded noun phrase built from it.", pairs: [["door", "the old, creaking door"], ["sky", "the dark, stormy sky"], ["path", "the narrow, winding path"]] },
            { kind: "order", question: "Order these from a bare noun to a fully expanded noun phrase.", items: ["door", "the wooden door", "the old, wooden door, hanging off its hinges"] },
          ],
          worksheet: [
            { text: "Add a comma to correctly punctuate this noun phrase: 'the cold dark cave'.", type: "short", answer: "the cold, dark cave" },
            { text: "Write an expanded noun phrase for 'shoes' using two adjectives, remembering the comma.", type: "extended", answer: "A good answer uses two different, well-chosen adjectives separated by a comma before the noun, e.g. 'the scuffed, muddy shoes'." },
            { text: "Write an expanded noun phrase for 'sky' that includes a describing phrase after the noun.", type: "extended", answer: "A good answer adds a describing phrase after the noun 'sky', e.g. 'the sky, streaked with orange and pink'." },
            { text: "Explain why using too many similar adjectives in one noun phrase can make writing weaker rather than stronger.", type: "extended", answer: "A good answer explains that adjectives with very similar meanings (e.g. big, huge, enormous) repeat the same idea instead of adding new information, so the writing sounds repetitive rather than more detailed." },
          ],
        },
        {
          slug: "using-figurative-language-to-describe",
          title: "Using similes and metaphors",
          pupilLessonOutcome: "I can use similes and metaphors to describe something in an imaginative way.",
          keyLearningPoints: [
            "A simile compares one thing to another using 'like' or 'as', e.g. 'the wind howled like a wolf'.",
            "A metaphor describes one thing as if it actually is another thing, without using 'like' or 'as', e.g. 'the wind was a wolf, howling through the trees'.",
            "Good similes and metaphors compare things that share a surprising or vivid similarity, not an obvious, overused one.",
            "Figurative language should help the reader imagine something more clearly, not just sound fancy.",
          ],
          keywords: [
            { keyword: "simile", description: "A comparison between two things using 'like' or 'as', e.g. 'as brave as a lion'." },
            { keyword: "metaphor", description: "A description that says one thing is another thing, to create a vivid image, e.g. 'the classroom was a zoo'." },
            { keyword: "figurative language", description: "Language that creates a picture in the reader's mind by comparing or describing things imaginatively, rather than literally." },
          ],
          misconceptions: [
            { misconception: "Pupils think any comparison using 'like' is automatically a good simile, even clichéd ones such as 'as white as snow' or 'as brave as a lion'.", response: "Explain that overused similes have lost their power to surprise the reader; encourage inventing a fresh comparison instead, e.g. 'as white as a hospital sheet'." },
            { misconception: "Pupils write a sentence with 'like' or 'as' in it but call it a metaphor, not realising that including those words automatically makes it a simile.", response: "Remind pupils of the simple test: if the sentence contains 'like' or 'as', it's a simile; if it says one thing IS another thing directly, it's a metaphor." },
          ],
          teacherTips: [
            "Give pupils a 'banned list' of overused similes (as white as snow, as brave as a lion, as fast as lightning) to push them towards inventing original comparisons.",
            "Model turning a simile into a metaphor and back again, so pupils see clearly how the two techniques relate.",
          ],
          transcript:
            "Hello! Today we're learning to describe things imaginatively using similes and metaphors.\n\nA simile compares one thing to another using the words 'like' or 'as'. For example: 'the wind howled like a wolf.' We're not saying the wind actually is a wolf, we're saying it sounds similar to one, to help the reader imagine how loud and frightening it was.\n\nA metaphor is a little bolder. Instead of comparing two things, it says one thing IS another thing. For example: 'the wind was a wolf, howling through the trees.' Here, we've said the wind was a wolf, without using 'like' or 'as'. It's the same idea as the simile, but stated more directly and dramatically.\n\nHere's a simple test to tell them apart. If the sentence has 'like' or 'as' in it, it's a simile. If it says something IS something else, with no 'like' or 'as', it's a metaphor.\n\nNow, here's something important. A good simile or metaphor compares two things that share a surprising similarity, not an obvious one that everyone has heard a thousand times before. 'As white as snow' or 'as brave as a lion' have been used so often that readers barely notice them anymore. A fresher simile might be 'as white as a hospital sheet' or 'as brave as a firefighter running into smoke'. These make the reader stop and really picture the comparison.\n\nLet's try building one together. Imagine we're describing a roaring fire. A simile might be: 'the flames danced like hungry tigers.' A metaphor for the same fire could be: 'the flames were hungry tigers, leaping and snapping.'\n\nThe mistake to avoid is thinking any comparison automatically makes good writing, even a tired, overused one. Always ask yourself: does this comparison help my reader picture something in a fresh way, or have they heard it a hundred times before?\n\nNow you'll practise writing your own similes and metaphors to describe a setting.",
          starterQuiz: [
            { kind: "mc", question: "What is an adjective?", correct: ["A word that describes a noun"], distractors: ["A naming word", "An action word", "A joining word"] },
            { kind: "mc", question: "Which of these is an expanded noun phrase?", correct: ["the dark, silent forest"], distractors: ["forest", "dark forest walked", "the forest was dark"] },
            { kind: "short", question: "What punctuation mark separates two adjectives before a noun?", answers: ["comma", ","] },
          ],
          exitQuiz: [
            { kind: "mc", question: "Which sentence contains a simile?", correct: ["The rain fell like tiny silver needles."], distractors: ["The rain was a curtain of silver needles.", "The rain fell heavily all afternoon.", "The silver rain fell."] },
            { kind: "mc", question: "Which sentence contains a metaphor?", correct: ["The classroom was a zoo."], distractors: ["The classroom was as noisy as a zoo.", "The classroom was quite noisy.", "The classroom, full of noise, echoed."] },
            { kind: "short", question: "What two words are used to signal a simile?", answers: ["like and as", "like, as"] },
            { kind: "match", question: "Match each technique to its example.", pairs: [["simile", "as fast as a cheetah"], ["metaphor", "the athlete was a cheetah"], ["expanded noun phrase", "the fast, agile athlete"]] },
            { kind: "order", question: "Order these from least to most imaginative description of speed.", items: ["fast", "very fast", "as fast as a cheetah bursting from the grass"] },
          ],
          worksheet: [
            { text: "Write a simile to describe a thunderstorm.", type: "extended", answer: "A good answer compares the thunderstorm to something else using 'like' or 'as', with a fresh, original comparison rather than a clichéd one, e.g. 'the thunder growled like a giant clearing its throat'." },
            { text: "Write a metaphor to describe a thunderstorm.", type: "extended", answer: "A good answer states the thunderstorm IS something else, with no 'like' or 'as', e.g. 'the storm was a drum, beating across the sky'." },
            { text: "Identify whether this sentence is a simile or a metaphor: 'The waves were galloping horses.'", type: "short", answer: "metaphor" },
            { text: "Explain why 'as brave as a lion' is a weaker simile than a fresh, original one you could invent.", type: "extended", answer: "A good answer explains that 'as brave as a lion' has been used so often that readers no longer picture it vividly, whereas an original comparison surprises the reader and creates a clearer, more memorable image." },
          ],
        },
        {
          slug: "building-a-setting-through-description",
          title: "Building a setting with description",
          pupilLessonOutcome: "I can use a range of descriptive techniques together to build a vivid setting in my writing.",
          keyLearningPoints: [
            "A well-built setting appeals to more than one sense: what can be seen, heard, smelled or felt.",
            "Combining expanded noun phrases, similes and metaphors creates a richer picture than using just one technique alone.",
            "Sentence length can affect atmosphere, e.g. short sentences can create tension, longer sentences can create a calm, flowing feel.",
            "Good setting description is chosen carefully to match the mood the writer wants to create, not just added for decoration.",
          ],
          keywords: [
            { keyword: "setting", description: "The time and place in which a story happens." },
            { keyword: "atmosphere", description: "The feeling or mood created in a piece of writing, e.g. eerie, peaceful, exciting." },
            { keyword: "senses", description: "The five ways we experience the world: sight, hearing, smell, taste and touch." },
          ],
          misconceptions: [
            { misconception: "Pupils only describe what a setting looks like, forgetting to include sound, smell or touch, which makes the writing feel flat.", response: "Prompt pupils with a simple checklist: what can you see, hear, smell and feel here? Encouraging even one extra sense adds real depth." },
            { misconception: "Pupils believe more description is always better, adding techniques to every single sentence until the writing becomes cluttered and hard to follow.", response: "Show that skilled writers choose their moments carefully — one powerful, well-placed simile has more impact than five crammed into one paragraph." },
          ],
          teacherTips: [
            "Read a short, well-written extract aloud and ask pupils to close their eyes and say what they can picture, hear and smell, to show how effective combined description feels to a reader.",
            "Encourage pupils to plan their setting description around a chosen mood first (e.g. spooky, peaceful) before choosing which techniques will create that mood.",
          ],
          transcript:
            "Hello! Over the last two lessons, you've learned to build expanded noun phrases and to write similes and metaphors. Today we're bringing all of that together to build a really vivid setting.\n\nA setting is the time and place where your story happens. To bring a setting to life, good writers think about more than just what it looks like. They think about all the senses: what can be seen, what can be heard, what can be smelled, and what can be felt.\n\nImagine you're describing an abandoned house. If you only describe what it looks like, you might write: 'The house was old and broken.' That's fine, but it's not very vivid. Now let's add other senses. What can we hear? 'Floorboards creaked like tired old bones.' That's a simile, and it uses sound. What can we smell? 'A damp, musty smell hung in the air.' That's an expanded noun phrase, and it uses smell. Suddenly the setting feels much more real, because the reader isn't just seeing it, they're experiencing it.\n\nSentence length matters too. Short sentences can create tension and urgency. 'The door creaked. Something moved.' Longer, flowing sentences can create a calmer, more peaceful atmosphere, weaving together gentle detail about a sunny meadow, for example.\n\nHere's something really important, though. More description is not always better. If every single sentence is crammed with adjectives, similes and metaphors, the writing becomes cluttered and tiring to read, and the powerful moments get lost among the ordinary ones. Skilled writers choose their best techniques carefully, and place them where they'll have the most impact.\n\nBefore you start writing, it helps to decide on the mood you want, spooky, peaceful, exciting, and then choose your senses, sentence lengths and figurative language to match that mood, rather than describing things at random.\n\nNow you're going to plan and write a setting description, choosing your techniques carefully to build a clear atmosphere.",
          starterQuiz: [
            { kind: "mc", question: "What does a simile use to compare two things?", correct: ["like or as"], distractors: ["is or was", "and or but", "the word 'metaphor'"] },
            { kind: "mc", question: "Which of these is a metaphor?", correct: ["The fog was a thick grey blanket."], distractors: ["The fog was like a thick grey blanket.", "The fog was thick and grey.", "The fog rolled in slowly."] },
            { kind: "short", question: "Name the five senses.", answers: ["sight, hearing, smell, taste, touch", "sight hearing smell taste touch"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is 'atmosphere' in a piece of writing?", correct: ["The feeling or mood the writing creates"], distractors: ["The setting of the story", "The main character's name", "The number of paragraphs used"] },
            { kind: "mc", question: "Which sentence uses the sense of sound to describe a setting?", correct: ["Floorboards creaked like tired old bones."], distractors: ["The house was painted grey.", "The garden had tall hedges.", "The path was made of stone."] },
            { kind: "short", question: "What can happen to writing if too many descriptive techniques are crammed into every sentence?", answers: ["it becomes cluttered", "it becomes cluttered and hard to follow"] },
            { kind: "match", question: "Match each sentence to the sense it mainly appeals to.", pairs: [["A damp, musty smell hung in the air.", "smell"], ["Floorboards creaked like tired old bones.", "hearing"], ["The wall was covered in crumbling, grey stone.", "sight"]] },
            { kind: "order", question: "Order these steps for planning a setting description.", items: ["choose the mood you want to create", "decide which senses to include", "choose techniques that match the mood", "write the description"] },
          ],
          worksheet: [
            { text: "Write one sentence describing a beach using the sense of sound.", type: "extended", answer: "A good answer describes a sound at the beach rather than a sight, e.g. 'Waves hissed and crashed against the rocks.'" },
            { text: "Write one sentence describing a forest using a simile.", type: "extended", answer: "A good answer includes a simile using 'like' or 'as' to describe part of the forest, e.g. 'The branches twisted like ancient, gnarled fingers.'" },
            { text: "Name the sense used in this sentence: 'The bread smelled warm and sweet.'", type: "short", answer: "smell" },
            { text: "Plan a short setting description for a spooky, abandoned playground. List which senses and techniques you would use before writing it.", type: "extended", answer: "A good answer names the mood (spooky), lists at least two senses (e.g. sight and sound), and names a technique such as a simile or metaphor it plans to use to build that mood." },
          ],
        },
      ],
    },
    {
      slug: "reading-and-responding-narrative",
      title: "Reading and responding: narrative",
      description:
        "Pupils develop skills in making inferences about characters, exploring what motivates a character's actions, and summarising the main points of a narrative.",
      whyThisWhyNow:
        "These are core reading comprehension skills for Year 5 and beyond, moving pupils from simply retrieving facts from a text to interpreting meaning that isn't stated directly.",
      priorKnowledge: [
        "Pupils can retrieve and record information from fiction texts.",
        "Pupils understand what a character is and can describe a character's actions in a story.",
        "Pupils can retell the main events of a story they have read.",
      ],
      nationalCurriculum: [
        "Draw inferences such as inferring characters' feelings, thoughts and motives from their actions, and justify inferences with evidence.",
        "Predict what might happen from details stated and implied.",
        "Summarise the main ideas drawn from more than one paragraph, identifying key details that support the main ideas.",
      ],
      lessons: [
        {
          slug: "making-inferences-about-characters",
          title: "Making inferences about characters",
          pupilLessonOutcome: "I can make an inference about a character using evidence from the text.",
          keyLearningPoints: [
            "An inference is a sensible conclusion we work out using clues in the text, rather than something the author states directly.",
            "Good inferences are always backed up with evidence, a quotation or detail from the text.",
            "Writers often show a character's feelings through their actions and words, rather than telling the reader directly, e.g. 'her hands trembled' shows nervousness without using the word 'nervous'.",
            "Different readers might infer slightly different things, but every inference must still be supported by evidence in the text.",
          ],
          keywords: [
            { keyword: "inference", description: "A sensible conclusion worked out from clues in a text, rather than something stated directly." },
            { keyword: "evidence", description: "Words or details from the text that support an idea or answer." },
            { keyword: "imply", description: "To suggest something without saying it directly, leaving the reader to work it out." },
          ],
          misconceptions: [
            { misconception: "Pupils think an inference can be any guess, even one with no connection to the text.", response: "Insist that every inference must be tied to a specific piece of evidence from the text; a guess with no evidence is not an inference, it's just a guess." },
            { misconception: "Pupils only look for feeling words the author has stated directly (like 'sad' or 'happy'), and struggle when a feeling is only shown through actions.", response: "Practise spotting 'show, don't tell' clues, such as physical actions or dialogue, and discuss what feeling those actions might reveal." },
          ],
          teacherTips: [
            "Use the phrase 'I think... because the text says...' as a sentence starter to force pupils to always link an inference to evidence.",
            "Model your own thinking aloud when reading a short extract, showing how you notice small clues and build them into an inference.",
          ],
          transcript:
            "Hello! Today we're learning a really important reading skill called making inferences.\n\nSometimes a writer tells us exactly how a character feels, using words like 'sad' or 'excited'. But often, skilled writers don't tell us directly. They show us through what a character does or says, and expect the reader to work it out. That skill of working something out from clues is called making an inference.\n\nLet's try an example. Imagine reading this sentence: 'Tom's hands trembled as he opened the letter, and he read it twice before saying a word.' The author never says Tom feels nervous. But we can infer it, because trembling hands and reading something twice before speaking are clues that suggest nervousness. We've used evidence from the text to work out something the writer didn't state directly.\n\nThis is the golden rule of inference: every inference must be backed up by evidence. It's not enough to just guess how a character feels. You need to point to the actual words in the text that led you to that idea. A really useful sentence starter is: 'I think... because the text says...' For example: 'I think Tom feels nervous because the text says his hands trembled and he read the letter twice before speaking.'\n\nTwo readers might sometimes infer slightly different things from the same clue, and that's fine, as long as both can point to evidence that supports their idea.\n\nA common mistake is treating an inference like any old guess, without checking it against the text. If someone said 'Tom feels excited' with no evidence to support it, that wouldn't be a proper inference, it would just be a guess, and it doesn't even fit the clues we were given.\n\nAnother mistake is only looking for feeling words stated outright, and missing clues hidden in a character's actions or dialogue. Writers often show feelings through what characters do, rather than telling us directly.\n\nNow you're going to practise making your own inferences from a short extract, using evidence to support every idea.",
          starterQuiz: [
            { kind: "mc", question: "What is a character in a story?", correct: ["A person or animal that the story is about"], distractors: ["The place where the story happens", "The main event in the story", "The title of the story"] },
            { kind: "mc", question: "Which word means to suggest something without saying it directly?", correct: ["imply"], distractors: ["state", "describe", "list"] },
            { kind: "short", question: "What is the opposite of 'nervous'?", answers: ["calm", "relaxed", "confident"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is an inference?", correct: ["A sensible conclusion worked out from clues in the text"], distractors: ["A fact stated directly by the author", "A summary of the whole story", "A character's exact words"] },
            { kind: "mc", question: "Which sentence gives a clue that a character is nervous, without stating it directly?", correct: ["Her voice shook as she began to speak."], distractors: ["She felt very nervous.", "She was a nervous person.", "Nervously, she began to speak."] },
            { kind: "short", question: "Complete this sentence starter used for inference answers: 'I think... because the text ___.'", answers: ["says", "says that"] },
            { kind: "match", question: "Match each clue to the feeling it most likely suggests.", pairs: [["His hands trembled and he couldn't meet her eyes.", "nervous"], ["She punched the air and grinned from ear to ear.", "excited"], ["He slammed the door and stormed off.", "angry"]] },
            { kind: "order", question: "Order the steps for answering an inference question.", items: ["find a clue in the text", "decide what feeling or idea the clue suggests", "write your answer using 'I think... because the text says...'"] },
          ],
          worksheet: [
            { text: "Read this sentence: 'Maya's eyes widened and she took a step back.' What can you infer about how Maya feels? Give your evidence.", type: "extended", answer: "A good answer infers a feeling such as shock, surprise or fear, and supports it with the evidence 'her eyes widened and she took a step back', using a structure like 'I think... because the text says...'." },
            { text: "What does it mean to make an 'inference'?", type: "short", answer: "a sensible conclusion worked out from clues in a text" },
            { text: "Read this sentence: 'Sam punched the air and cheered loudly.' What can you infer about how Sam feels?", type: "short", answer: "excited or happy" },
            { text: "Explain why an inference must always be supported by evidence from the text.", type: "extended", answer: "A good answer explains that without evidence an inference is just a guess, and pointing to a specific detail or quotation shows the idea is genuinely based on what the text says, not made up." },
          ],
        },
        {
          slug: "exploring-character-motivation",
          title: "Exploring character motivation",
          pupilLessonOutcome: "I can explain why a character acts the way they do, using evidence from the text.",
          keyLearningPoints: [
            "Motivation is the reason behind a character's actions, what they want or fear that makes them act that way.",
            "We can work out a character's motivation by looking at what they say, what they do, and how they react to events.",
            "A character's motivation can change as a story develops, especially after something important happens to them.",
            "Understanding motivation helps readers predict what a character might do next.",
          ],
          keywords: [
            { keyword: "motivation", description: "The reason behind a character's actions: what they want, need or fear." },
            { keyword: "predict", description: "To use clues from the text to work out what might happen next." },
            { keyword: "react", description: "To respond to something that happens, through actions, words or feelings." },
          ],
          misconceptions: [
            { misconception: "Pupils describe what a character did, but not why they did it, treating the two as the same thing.", response: "Ask the follow-up question 'but why did they do that?' every time, pushing pupils past describing the action towards explaining the reason behind it." },
            { misconception: "Pupils assume a character's motivation stays exactly the same throughout the whole story, even after a major event changes things for them.", response: "Discuss how real people's motivations can shift after something important happens, and encourage pupils to check whether a character's reasons for acting change at key moments in the plot." },
          ],
          teacherTips: [
            "Use a simple 'want/because' frame: 'The character wants ___ because ___', to help pupils separate the goal from the reason behind it.",
            "Compare two characters with different motivations for a similar action, to show pupils that the same action can come from very different reasons.",
          ],
          transcript:
            "Hello! Today we're exploring character motivation, which means working out why a character does what they do.\n\nEvery character in a good story has reasons behind their actions, just like real people do. We call this motivation. It's not enough to just describe what a character did, we need to dig a little deeper and ask why they did it.\n\nLet's think about an example. Imagine a character called Freya who secretly gives away her lunch every day at school. If we only describe what she does, we might say, 'Freya gives away her lunch.' But that doesn't tell us anything about why. Perhaps later in the story we learn that Freya's little brother doesn't have enough food at home. Suddenly, her action makes sense: her motivation is that she wants to help her brother, because she cares about him and worries about him going hungry.\n\nHow do we work out a character's motivation? We look closely at three things: what the character says, what they do, and how they react when things happen around them. These clues, put together, help us understand what a character wants, needs, or fears.\n\nHere's something important: a character's motivation can change during a story. If something big happens, like Freya's secret being discovered, her reasons for acting might shift. Maybe she starts asking for help instead of hiding the problem alone. Good readers keep checking whether a character's motivation has changed at key moments in the plot.\n\nUnderstanding motivation is really useful, because once we know what a character wants, we can start predicting what they might do next. If we know Freya cares deeply about her brother, we can predict she'll keep trying to help him, even if it's difficult.\n\nA common mistake is describing an action without ever explaining the reason behind it. If you find yourself just retelling what happened, stop and ask: but why did they do that? That question will always push you towards motivation, not just description.\n\nNow you'll practise working out character motivation from a short extract.",
          starterQuiz: [
            { kind: "mc", question: "What is an inference?", correct: ["A sensible conclusion worked out from clues in a text"], distractors: ["A made-up story", "A list of characters", "A type of punctuation"] },
            { kind: "mc", question: "Which of these is evidence from a text?", correct: ["A quotation or detail taken from what is written"], distractors: ["A reader's opinion with no quote", "A guess with no support", "The title of the book"] },
            { kind: "short", question: "What do we call the main person or animal a story is about?", answers: ["a character", "character"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What does 'motivation' mean?", correct: ["The reason behind a character's actions"], distractors: ["The setting of a story", "A character's physical appearance", "The title of a chapter"] },
            { kind: "mc", question: "Which question helps us find a character's motivation?", correct: ["Why did they do that?"], distractors: ["What did they do?", "Where did it happen?", "When did it happen?"] },
            { kind: "short", question: "Name the three things we look at to work out a character's motivation: what they ___, what they ___, and how they ___.", answers: ["say, do, react", "say do react"] },
            { kind: "match", question: "Match each character action to a possible motivation.", pairs: [["A boy hides his torn school jumper from his mum.", "He doesn't want to worry her."], ["A girl practises football every evening alone.", "She wants to make the school team."], ["A boy shares his sandwich with a new pupil.", "He wants the new pupil to feel welcome."]] },
            { kind: "order", question: "Order these steps for working out a character's motivation.", items: ["notice what the character says and does", "think about how they react to events", "ask why they might be acting this way", "decide what they want, need or fear"] },
          ],
          worksheet: [
            { text: "Read: 'Every break time, Leo sat alone by the fence, sketching in his notebook.' Suggest a possible motivation for Leo's behaviour, using evidence.", type: "extended", answer: "A good answer suggests a plausible reason, such as Leo preferring a quiet hobby or feeling shy around other pupils, supported by the evidence that he sits alone and sketches every break time." },
            { text: "What is the difference between describing what a character did and explaining their motivation?", type: "extended", answer: "A good answer explains that describing an action just says what happened, while explaining motivation says why the character did it, what they wanted, needed or feared." },
            { text: "Give one example of how a character's motivation might change after something big happens in a story.", type: "extended", answer: "A good answer gives a plausible example, such as a character who was acting secretly out of fear starting to ask for help once their secret is discovered and they realise people want to support them." },
            { text: "Name the three types of clues we look at to work out a character's motivation.", type: "short", answer: "what they say, what they do, how they react" },
          ],
        },
        {
          slug: "summarising-a-narrative",
          title: "Summarising a narrative",
          pupilLessonOutcome: "I can summarise the main events of a narrative in a few clear sentences.",
          keyLearningPoints: [
            "A summary retells the most important events of a story in a much shorter form, leaving out minor details.",
            "A good summary follows the order the events happened in the story.",
            "Summarising is different from retelling everything; a summary should only include the key events needed to understand the story.",
            "Using time connectives (first, then, next, finally) helps organise a summary clearly.",
          ],
          keywords: [
            { keyword: "summary", description: "A short account that gives the main points of something, leaving out unnecessary detail." },
            { keyword: "key event", description: "An important moment in a story that affects what happens next." },
            { keyword: "time connective", description: "A word or phrase that shows when something happens in relation to other events, e.g. 'first', 'later', 'finally'." },
          ],
          misconceptions: [
            { misconception: "Pupils write a summary that is almost as long as the original text, including every small detail.", response: "Model choosing only the events that really matter, using the test: 'would the story still make sense if I left this detail out?' — if yes, it can be cut." },
            { misconception: "Pupils summarise events out of order, or muddle the order in which things happened.", response: "Encourage pupils to jot down key events as a simple numbered list first, checking the order against the text, before turning them into a written summary." },
          ],
          teacherTips: [
            "Give pupils a strict word or sentence limit for their summary, forcing them to select only the most essential events.",
            "Model highlighting or underlining only the key events in a printed extract before summarising, so pupils see what to leave out as well as what to include.",
          ],
          transcript:
            "Hello! Today we're learning how to summarise a narrative, which means retelling the most important parts of a story in a much shorter way.\n\nImagine your friend asks what happened in a book you've just finished. You wouldn't tell them every single sentence from the story, that would take far too long, and most of it wouldn't be needed. Instead, you'd pick out the key events, the moments that really matter to the story, and tell them in order.\n\nLet's practise with a simple example. Imagine a story where a boy called Sam finds an injured bird in his garden, secretly looks after it in a shoebox for two weeks, worries about hiding it from his parents, and finally releases it back into the wild once it's healed. A good summary might be: 'Sam finds an injured bird, secretly cares for it, and eventually releases it once it's better.' Notice how this leaves out smaller details, like exactly how many days it took, but keeps the events that really matter.\n\nA summary should also follow the order the events happened in. Using time connectives like 'first', 'next', 'after that' and 'finally' helps organise your summary clearly, so the reader can follow along easily.\n\nHere's a good test for deciding what to include: ask yourself, 'would the story still make sense if I left this detail out?' If the answer is yes, that detail probably isn't essential enough for your summary. If leaving it out would make the story confusing, it needs to stay in.\n\nA common mistake is writing a summary that's almost as long as the original story, because every small detail feels important when you've just read it. Try to be really strict with yourself, and only keep the events the story couldn't work without.\n\nAnother mistake is jumbling the order of events. A helpful trick is to jot down the key events as a quick numbered list first, checking they're in the right order, before turning them into full sentences.\n\nNow you'll practise summarising a short narrative into just a few clear sentences.",
          starterQuiz: [
            { kind: "mc", question: "What is a character's motivation?", correct: ["The reason behind their actions"], distractors: ["Their name", "Their appearance", "The setting they are in"] },
            { kind: "mc", question: "Which of these words is a time connective?", correct: ["finally"], distractors: ["forest", "character", "adjective"] },
            { kind: "short", question: "Put these events in order: woke up, ate breakfast, went to school. What happened first?", answers: ["woke up"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is a summary?", correct: ["A short account giving only the main points of a story"], distractors: ["A word-for-word retelling of a story", "A list of every character in a story", "The title and author of a book"] },
            { kind: "mc", question: "Which of these should be included in a summary?", correct: ["The key events that the story couldn't work without"], distractors: ["Every single sentence from the text", "Only the setting", "Only the characters' names"] },
            { kind: "short", question: "Give one example of a time connective.", answers: ["first", "then", "next", "finally", "after that", "later"] },
            { kind: "match", question: "Match each part of a story to whether it usually belongs in a summary.", pairs: [["A key event that changes the story", "Include in summary"], ["A minor detail about the weather on one page", "Leave out of summary"], ["The final outcome of the story", "Include in summary"]] },
            { kind: "order", question: "Order these steps for writing a summary.", items: ["read the whole text", "list the key events in order", "check nothing important is missing", "write the summary in a few clear sentences"] },
          ],
          worksheet: [
            { text: "Read: 'A girl called Priya loses her dog at the park, spends the afternoon searching with her neighbours, and finds him hiding under a bench just before it gets dark.' Write a one or two sentence summary of this story.", type: "extended", answer: "A good answer keeps only the key events in order, e.g. 'Priya loses her dog at the park, searches with her neighbours, and finds him hiding under a bench before dark,' without adding extra invented detail." },
            { text: "Name two time connectives you could use in a summary.", type: "short", answer: "first, then, next, finally, after that, later" },
            { text: "Explain the test you can use to decide whether a detail should be included in a summary.", type: "extended", answer: "A good answer describes asking whether the story would still make sense without that detail; if yes, it can be left out, if the story would become confusing without it, it should stay in." },
            { text: "Explain why a summary should follow the order the events happened in the story.", type: "extended", answer: "A good answer explains that keeping events in order helps the reader understand how one event led to the next and follow the story clearly, rather than becoming confused about what happened when." },
          ],
        },
      ],
    },
  ],
};
