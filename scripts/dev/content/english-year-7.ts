import type { SubjectYearSpec } from "./types";

export const englishYear7: SubjectYearSpec =   {
    subject: { slug: "english", title: "English" },
    programme: {
      sequenceSlug: "english-secondary",
      yearGroup: 7,
      keyStage: "ks3",
      phase: "secondary",
      title: "English — Year 7",
    },
    units: [
      {
        slug: "narrative-writing-descriptive-settings",
        title: "Narrative writing: descriptive settings",
        description:
          "Pupils learn to write vivid, sensory descriptions of settings using figurative language and precise word choices to create atmosphere in narrative writing.",
        whyThisWhyNow:
          "Descriptive setting-writing is a foundational narrative skill that pupils will draw on throughout KS3 for creative writing tasks and analysing published fiction.",
        priorKnowledge: [
          "Pupils can write in full sentences using a range of simple punctuation.",
          "Pupils are familiar with adjectives and simple similes from primary school.",
          "Pupils can identify the five senses.",
        ],
        nationalCurriculum: [
          "Write for a range of purposes and audiences, including narrative and descriptive writing.",
          "Use a range of vocabulary and sentence structures for effect.",
          "Use figurative language, including simile and metaphor, to create effects.",
        ],
        lessons: [
          {
            slug: "using-the-five-senses",
            title: "Using the five senses to build a setting",
            pupilLessonOutcome: "I can use sensory detail to describe a setting vividly.",
            keyLearningPoints: [
              "Skilled descriptive writing appeals to more than one of the five senses: sight, sound, smell, touch and taste.",
              "Choosing specific, concrete details is more effective than vague, general statements.",
              "Sensory description helps the reader imagine they are physically present in the setting.",
              "Not every sense needs to be used in every description — writers select senses that suit the mood they want to create.",
            ],
            keywords: [
              { keyword: "sensory detail", description: "Descriptive language that appeals to one or more of the five senses to help the reader imagine a scene." },
              { keyword: "setting", description: "The time and place in which a story or scene happens." },
              { keyword: "atmosphere", description: "The mood or feeling created in a piece of writing, e.g. tense, peaceful, eerie." },
            ],
            misconceptions: [
              { misconception: "Pupils think good description just means using lots of adjectives.", response: "Show that precise, well-chosen details (e.g. 'the damp smell of moss') are more powerful than piling up adjectives (e.g. 'the big, dark, scary, old forest')." },
              { misconception: "Pupils believe they must use all five senses in every paragraph.", response: "Explain that skilled writers choose the senses that best suit the mood — for instance, a description of a bakery might focus on smell and taste rather than sound." },
            ],
            teacherTips: [
              "Model annotating a short published extract to identify which senses the writer has used and why.",
              "Give pupils a simple setting (e.g. a beach, a forest) and ask them to brainstorm one detail for each sense before they start writing, to build the habit.",
            ],
            transcript:
              "Today we're starting a new unit on narrative writing, and we're focusing on how to describe a setting vividly using our five senses.\n\nWhen we write a story, the setting is the time and place where the action happens. A weak description might simply say, 'The forest was dark and scary.' That tells the reader something, but it doesn't help them really imagine being there. Strong descriptive writing appeals to the reader's senses — sight, sound, smell, touch, and taste — so they can picture, hear, and even smell the scene in their mind.\n\nLet's take that forest example and add sensory detail. Instead of just 'dark and scary', we might write: 'Twisted branches blotted out the last of the daylight, and the damp smell of moss clung to the air. Somewhere close by, a twig snapped.' Notice how this description uses sight — the twisted branches blotting out light — smell — the damp moss — and sound — the snapping twig. Together, these specific, concrete details do far more work than a vague adjective like 'scary'.\n\nIt's a common misconception that good description simply means using lots of adjectives. Actually, one precise, carefully chosen detail is far more powerful than a string of general adjectives. Compare 'the big, dark, scary, old forest' with 'the damp smell of moss and rotting leaves' — the second version, using a single sensory detail, creates a much stronger picture in the reader's mind.\n\nYou also don't need to use all five senses in every description. Skilled writers choose the senses that best fit the atmosphere, or mood, they want to create. A description of a busy bakery might focus on smell — the scent of fresh bread — and sound — the chatter of customers — rather than touch.\n\nToday, you'll be practising writing sensory descriptions of a setting of your choice, thinking carefully about which senses will create the atmosphere you want.",
            starterQuiz: [
              { kind: "mc", question: "How many senses can descriptive writing appeal to?", correct: ["Five"], distractors: ["Three", "Two", "Ten"] },
              { kind: "mc", question: "What is the 'setting' of a story?", correct: ["The time and place in which the story happens"], distractors: ["The main character", "The problem in the story", "The ending"] },
              { kind: "short", question: "Name one of the five senses.", answers: ["sight", "sound", "smell", "touch", "taste"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "Which sentence uses sensory detail most effectively?", correct: ["The damp smell of moss clung to the cold morning air."], distractors: ["The forest was scary.", "It was a forest.", "The forest was big and dark and scary and old."] },
              { kind: "mc", question: "Which of these are examples of sensory detail? (select all that apply)", correct: ["the sharp tang of salt in the air", "the crunch of gravel underfoot"], distractors: ["the story had three chapters", "the character was called Sam"] },
              { kind: "short", question: "Name the mood or feeling created in a piece of writing.", answers: ["atmosphere"] },
              { kind: "match", question: "Match each sense to an example detail.", pairs: [["sight", "the flickering orange glow of the fire"], ["smell", "the sweet scent of fresh bread"], ["sound", "the distant rumble of thunder"]] },
              { kind: "order", question: "Order these from vaguest to most vivid: 'It was dark.', 'The forest was dark and scary.', 'Twisted branches blotted out the last of the daylight.'", items: ["It was dark.", "The forest was dark and scary.", "Twisted branches blotted out the last of the daylight."] },
            ],
            worksheet: [
              { text: "Write one sentence describing a beach using the sense of sound.", type: "extended" },
              { text: "Name two senses other than sight that a writer could use to describe a busy kitchen.", type: "short", answer: "smell and sound" },
              { text: "Explain why one precise sensory detail is often more effective than several vague adjectives.", type: "extended" },
              { text: "Rewrite this sentence to include sensory detail: 'The room was cold.'", type: "extended" },
            ],
          },
          {
            slug: "creating-atmosphere-with-figurative-language",
            title: "Creating atmosphere with figurative language",
            pupilLessonOutcome: "I can use simile, metaphor and personification to create a particular atmosphere in a description.",
            keyLearningPoints: [
              "A simile compares one thing to another using 'like' or 'as'.",
              "A metaphor describes one thing as if it were another, without using 'like' or 'as'.",
              "Personification gives human qualities or actions to non-human things.",
              "Figurative language should be chosen deliberately to reinforce the atmosphere a writer wants to create.",
            ],
            keywords: [
              { keyword: "simile", description: "A comparison between two different things using 'like' or 'as', e.g. 'as cold as ice'." },
              { keyword: "metaphor", description: "A description of one thing as though it were another, without using 'like' or 'as', e.g. 'the classroom was a zoo'." },
              { keyword: "personification", description: "Giving human qualities or actions to something that is not human, e.g. 'the wind howled'." },
            ],
            misconceptions: [
              { misconception: "Pupils confuse similes and metaphors, thinking any comparison is a simile.", response: "Contrast the two directly: 'the fog was like a blanket' (simile, uses 'like') versus 'the fog was a blanket' (metaphor, no 'like' or 'as')." },
              { misconception: "Pupils use figurative language randomly, without considering whether it fits the intended atmosphere.", response: "Discuss how a metaphor like 'the sun was a golden coin' suits a cheerful mood, while 'the sun was a burning eye' suits a threatening one — the same idea, different effect." },
            ],
            teacherTips: [
              "Give pupils pairs of similes/metaphors describing the same thing with opposite moods, and ask them to identify which mood each creates.",
              "Encourage pupils to draft a simile or metaphor and then ask themselves: 'does this fit the atmosphere I want?'",
            ],
            transcript:
              "In our last lesson we looked at using our five senses to describe a setting. Today we're adding another powerful tool to our writing: figurative language, specifically simile, metaphor and personification.\n\nA simile compares one thing to another using the words 'like' or 'as'. For example: 'The lake was as still as glass.' Here we're comparing the stillness of the lake to glass, using the word 'as' to make the comparison clear.\n\nA metaphor also compares two things, but it does so without using 'like' or 'as' — instead, it describes one thing as if it actually were the other. For example: 'The lake was a sheet of glass.' Notice there's no 'like' or 'as' here; we are saying the lake is glass, even though we know it isn't literally glass. This creates a stronger, more direct image than a simile.\n\nPersonification is when we give human qualities or actions to something that isn't human. For example: 'The wind howled through the trees' — wind can't literally howl like an animal or a person crying out, but describing it that way makes it feel alive and threatening.\n\nThe most important thing to remember is that figurative language should always be chosen deliberately, to support the atmosphere you want to create. Let's compare two descriptions of the sun. 'The sun was a golden coin in the sky' creates a warm, cheerful atmosphere. But 'the sun was a burning eye, watching everything below' creates a much more threatening, uncomfortable atmosphere — even though both are metaphors describing the sun. The choice of figurative language completely changes how the reader feels.\n\nA common error is mixing up similes and metaphors. Remember: if you see 'like' or 'as', it's a simile; if there's a direct comparison with no 'like' or 'as', it's a metaphor. Today, you'll practise writing similes, metaphors and personification, thinking carefully about the atmosphere each choice creates.",
            starterQuiz: [
              { kind: "mc", question: "Which words does a simile use to compare two things?", correct: ["like or as"], distractors: ["is or was", "and or but", "if or then"] },
              { kind: "mc", question: "What is personification?", correct: ["Giving human qualities to non-human things"], distractors: ["Comparing two things using 'like'", "Describing a setting using only sound", "Repeating a word for effect"] },
              { kind: "short", question: "Is 'the lake was like glass' a simile or a metaphor?", answers: ["simile"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "Which sentence is a metaphor?", correct: ["The classroom was a zoo."], distractors: ["The classroom was like a zoo.", "The classroom was as loud as a zoo.", "The classroom had many animals."] },
              { kind: "mc", question: "Which of these sentences use personification? (select all that apply)", correct: ["The wind howled through the trees.", "The old house groaned in the storm."], distractors: ["The wind was strong.", "The house was old."] },
              { kind: "short", question: "Write a simile describing snow.", answers: ["as white as snow", "white as cotton wool"] },
              { kind: "match", question: "Match each term to its definition.", pairs: [["simile", "a comparison using like or as"], ["metaphor", "describing one thing as if it were another"], ["personification", "giving human qualities to non-human things"]] },
              { kind: "order", question: "Order these techniques from most direct comparison to least direct: metaphor, simile, plain description.", items: ["metaphor", "simile", "plain description"] },
            ],
            worksheet: [
              { text: "Write a simile describing a thunderstorm.", type: "extended" },
              { text: "Write a metaphor describing the moon.", type: "extended" },
              { text: "Explain the difference between a simile and a metaphor, using an example of each.", type: "extended" },
              { text: "Write a sentence using personification to describe the sea.", type: "extended" },
            ],
          },
          {
            slug: "choosing-precise-vocabulary",
            title: "Choosing precise vocabulary for effect",
            pupilLessonOutcome: "I can select precise, ambitious vocabulary to strengthen the effect of a description.",
            keyLearningPoints: [
              "Precise vocabulary creates a clearer, more specific image than general or overused words.",
              "Verbs and adjectives can be upgraded to more powerful synonyms to strengthen a description.",
              "Word choice affects the connotations, or associated feelings, a reader experiences.",
              "Writers should avoid overusing the same words and instead vary vocabulary for effect.",
            ],
            keywords: [
              { keyword: "connotation", description: "The feeling or idea a word suggests beyond its literal meaning, e.g. 'stroll' suggests calm, while 'stride' suggests purpose." },
              { keyword: "synonym", description: "A word with a similar meaning to another word." },
              { keyword: "precise", description: "Exact and specific, rather than vague or general." },
            ],
            misconceptions: [
              { misconception: "Pupils think a 'better' word is simply a longer or more unusual word.", response: "Show that the most effective word choice is the one that most precisely fits the meaning and atmosphere, not necessarily the longest or most obscure word." },
              { misconception: "Pupils believe all synonyms are interchangeable.", response: "Compare synonyms with different connotations, e.g. 'thin' versus 'skeletal', to show that word choice changes the reader's feeling, not just the literal meaning." },
            ],
            teacherTips: [
              "Build a class 'word bank' upgrading common overused words (e.g. 'said', 'walked', 'big') into more precise alternatives.",
              "Discuss connotation directly by comparing near-synonyms and asking pupils which feels more positive or negative.",
            ],
            transcript:
              "Over the last two lessons, we've explored sensory detail and figurative language. Today we're focusing on something just as important: choosing precise vocabulary.\n\nPrecise vocabulary means choosing the exact word that best captures your meaning, rather than a vague, general, or overused one. Let's compare two sentences: 'He walked into the room' and 'He crept into the room.' Both use a verb meaning to move into a space, but 'crept' is far more precise — it tells us he moved quietly and carefully, perhaps because he didn't want to be noticed. 'Walked' doesn't give us any of that extra information.\n\nA common misconception is thinking that a 'better' word is just a longer or more unusual one. That's not true. The best word choice is the one that most precisely matches your meaning and the atmosphere you want to create — sometimes that will be a simple word, and sometimes a more ambitious one, but the key is precision, not length.\n\nWe also need to think about connotation — the feelings or ideas a word suggests beyond its basic dictionary meaning. Consider the words 'thin' and 'skeletal'. Both technically describe someone who isn't heavy, but 'thin' is fairly neutral, while 'skeletal' suggests something much more alarming — perhaps illness or starvation. Choosing between these words completely changes how a reader feels about a character, even though the literal meaning is similar.\n\nIt's also important to vary your vocabulary rather than repeating the same words again and again. If every character in your story 'said' something, your writing can feel flat. Building a bank of precise synonyms — 'whispered', 'demanded', 'muttered', 'exclaimed' — lets you show exactly how something was said, adding both precision and variety.\n\nToday, you'll be revising a piece of your own descriptive writing, hunting for vague or overused words and replacing them with more precise, deliberate choices.",
            starterQuiz: [
              { kind: "mc", question: "What does 'precise' mean?", correct: ["Exact and specific"], distractors: ["Long and unusual", "Simple and short", "Repeated often"] },
              { kind: "mc", question: "What is a synonym?", correct: ["A word with a similar meaning to another word"], distractors: ["A word that means the opposite of another word", "A type of punctuation", "A figure of speech"] },
              { kind: "short", question: "Give a more precise synonym for 'walked' that suggests moving quietly.", answers: ["crept", "tiptoed", "sneaked"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "What is 'connotation'?", correct: ["The feeling or idea a word suggests beyond its literal meaning"], distractors: ["The opposite meaning of a word", "The spelling of a word", "The number of syllables in a word"] },
              { kind: "mc", question: "Which of these words have a negative connotation? (select all that apply)", correct: ["skeletal", "stench"], distractors: ["slender", "aroma"] },
              { kind: "short", question: "Give a precise synonym for 'said' that shows someone spoke angrily.", answers: ["shouted", "snapped", "demanded", "yelled"] },
              { kind: "match", question: "Match each overused word to a more precise alternative.", pairs: [["walked", "strolled"], ["said", "whispered"], ["big", "enormous"]] },
              { kind: "order", question: "Order these words from most neutral to most negative connotation: 'slim', 'thin', 'skeletal'.", items: ["slim", "thin", "skeletal"] },
            ],
            worksheet: [
              { text: "Give a more precise synonym for 'happy'.", type: "short", answer: "delighted" },
              { text: "Explain the difference in connotation between 'confident' and 'arrogant'.", type: "extended" },
              { text: "Rewrite this sentence with more precise vocabulary: 'The dog ran across the field.'", type: "extended" },
              { text: "Give a precise synonym for 'sad' that suggests deep grief.", type: "short", answer: "devastated" },
            ],
          },
        ],
      },
      {
        slug: "introduction-to-poetry-form-and-language",
        title: "Introduction to poetry: form and language",
        description:
          "Pupils explore how poets use form, structure and language choices to create meaning and effect, developing skills to read and analyse unfamiliar poems.",
        whyThisWhyNow:
          "This unit introduces the key terminology and analytical approaches pupils will use throughout KS3 and KS4 when studying poetry.",
        priorKnowledge: [
          "Pupils have encountered rhyme and rhythm in poems read at primary school.",
          "Pupils can identify a simile and a metaphor.",
          "Pupils understand what a stanza is.",
        ],
        nationalCurriculum: [
          "Read and appreciate the depth and power of the English literary heritage through poetry.",
          "Analyse the language, structure and form of texts.",
          "Develop the confident use of Standard English in analytical writing.",
        ],
        lessons: [
          {
            slug: "exploring-rhyme-and-rhythm",
            title: "Exploring rhyme and rhythm",
            pupilLessonOutcome: "I can identify rhyme schemes and describe the effect of rhythm in a poem.",
            keyLearningPoints: [
              "A rhyme scheme is the pattern of rhyming words at the end of each line, often described using letters, e.g. ABAB.",
              "Rhythm is the pattern of stressed and unstressed syllables in a line of poetry.",
              "Regular rhyme and rhythm can create a sense of order, musicality, or momentum.",
              "Poets sometimes break a regular rhyme or rhythm pattern deliberately, to draw attention to a particular line.",
            ],
            keywords: [
              { keyword: "rhyme scheme", description: "The pattern of rhyming words at the ends of lines in a poem, labelled with letters such as ABAB." },
              { keyword: "rhythm", description: "The pattern of stressed and unstressed syllables in a line of poetry." },
              { keyword: "stanza", description: "A group of lines forming a unit within a poem, similar to a paragraph in prose." },
            ],
            misconceptions: [
              { misconception: "Pupils think all poems must rhyme.", response: "Introduce free verse as an example of poetry with no fixed rhyme scheme, to show rhyme is a choice, not a requirement." },
              { misconception: "Pupils believe rhythm is only about how a poem sounds, with no meaning or effect.", response: "Demonstrate how a fast, bouncing rhythm can create excitement or urgency, while a slow, heavy rhythm can create solemnity, linking rhythm directly to meaning." },
            ],
            teacherTips: [
              "Read poems aloud so pupils can hear rhythm and rhyme in action, rather than only seeing them on the page.",
              "Use letters (A, B, C...) on the board to help pupils physically map out a rhyme scheme before naming it.",
            ],
            transcript:
              "Welcome to our new unit on poetry. Today we're exploring two of the building blocks of poetry: rhyme and rhythm.\n\nA rhyme scheme is the pattern of rhyming words at the end of each line in a poem. We describe rhyme schemes using letters. If the first and second lines rhyme with each other, and the third and fourth lines rhyme with each other, we call that an AABB rhyme scheme. If instead the first and third lines rhyme, and the second and fourth lines rhyme, we call that ABAB.\n\nIt's a common misconception that all poems must rhyme. That's not true — many poems, called free verse, have no fixed rhyme scheme at all. Rhyme is a choice a poet makes, not a rule they must follow. A poet chooses to rhyme, or not to rhyme, depending on the effect they want to create.\n\nRhythm is a different but related idea. Rhythm is the pattern of stressed and unstressed syllables in a line — think of it like the poem's heartbeat. If you read a nursery rhyme aloud, like 'Twinkle, twinkle, little star', you can hear a strong, bouncy rhythm. That regular, bouncy rhythm suits a poem meant to be light-hearted or playful.\n\nRhythm isn't just about sound for its own sake — it affects meaning too. A fast, bouncing rhythm can create a sense of excitement or urgency, while a slow, heavy rhythm, full of long words and pauses, can create a solemn or serious mood. Poets choose their rhythm deliberately to match what they want the reader to feel.\n\nSometimes, a poet will deliberately break their own regular pattern of rhyme or rhythm. If a poem has been rhyming steadily and then suddenly a line doesn't rhyme, that's not a mistake — it's often a deliberate choice to make that line stand out and draw the reader's attention. Today, we'll read some poems aloud and practise identifying rhyme schemes and describing the effect of rhythm.",
            starterQuiz: [
              { kind: "mc", question: "What is a rhyme scheme?", correct: ["The pattern of rhyming words at the end of each line"], distractors: ["The number of lines in a poem", "The topic of a poem", "The number of syllables in a word"] },
              { kind: "mc", question: "How is a rhyme scheme usually labelled?", correct: ["Using letters, e.g. ABAB"], distractors: ["Using numbers, e.g. 1234", "Using colours", "Using punctuation marks"] },
              { kind: "short", question: "What do we call a group of lines forming a unit within a poem?", answers: ["stanza"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "Which of these is true about rhyme in poetry?", correct: ["Not all poems rhyme."], distractors: ["All poems must rhyme.", "Only old poems rhyme.", "Rhyme has no effect on meaning."] },
              { kind: "mc", question: "Which of these effects can rhythm create in a poem? (select all that apply)", correct: ["excitement or urgency", "a solemn or serious mood"], distractors: ["the poem's exact word count", "the poem's publication date"] },
              { kind: "short", question: "Name the pattern of stressed and unstressed syllables in a line of poetry.", answers: ["rhythm"] },
              { kind: "match", question: "Match each rhyme scheme label to its description.", pairs: [["AABB", "lines 1&2 rhyme, lines 3&4 rhyme"], ["ABAB", "lines 1&3 rhyme, lines 2&4 rhyme"], ["free verse", "no fixed rhyme scheme"]] },
              { kind: "order", question: "Order these poem types from most regular rhyme to least regular rhyme: strict AABB rhyme scheme, occasional rhyme, free verse.", items: ["strict AABB rhyme scheme", "occasional rhyme", "free verse"] },
            ],
            worksheet: [
              { text: "What rhyme scheme label would you give a poem where lines 1 and 2 rhyme, and lines 3 and 4 rhyme?", type: "short", answer: "AABB" },
              { text: "Explain how a fast, bouncy rhythm might affect the mood of a poem.", type: "extended" },
              { text: "What is 'free verse'?", type: "short", answer: "poetry with no fixed rhyme scheme" },
              { text: "Why might a poet deliberately break their rhyme scheme on one line?", type: "extended" },
            ],
          },
          {
            slug: "understanding-stanza-and-structure",
            title: "Understanding stanza and structure",
            pupilLessonOutcome: "I can identify how a poem is structured into stanzas and explain how structure shapes meaning.",
            keyLearningPoints: [
              "A stanza is a group of lines forming a unit within a poem, similar to a paragraph in prose.",
              "Poets can use stanza length and line length to control pace and emphasis.",
              "A change in structure (e.g. a shorter stanza, or a single-line stanza) can signal a shift in tone or idea.",
              "Structure includes features such as enjambment (a sentence running over from one line to the next) and caesura (a pause within a line).",
            ],
            keywords: [
              { keyword: "stanza", description: "A group of lines forming a unit within a poem, similar to a paragraph in prose." },
              { keyword: "enjambment", description: "When a sentence or phrase runs on from one line of poetry to the next without a pause." },
              { keyword: "caesura", description: "A deliberate pause or break within a line of poetry, often marked by punctuation." },
            ],
            misconceptions: [
              { misconception: "Pupils think stanza breaks are random and have no purpose.", response: "Show an example where a stanza break marks a clear shift in time, place, or idea, to demonstrate that structure is a deliberate choice." },
              { misconception: "Pupils confuse enjambment with just 'a long sentence'.", response: "Clarify that enjambment specifically means a sentence continues across a line break without punctuation, forcing the reader onward, which is a specific structural technique, not just sentence length." },
            ],
            teacherTips: [
              "Show a poem with its stanza breaks removed, and ask pupils to guess where they think the breaks should go and why.",
              "Read a poem with enjambment aloud, pausing to show how it creates a sense of momentum or urgency.",
            ],
            transcript:
              "In our last lesson we looked at rhyme and rhythm. Today we're looking at another key building block of poetry: structure, including stanzas.\n\nA stanza is a group of lines that form a unit within a poem — you can think of it like a paragraph in prose writing. Just as a new paragraph often signals a new idea in an essay, a new stanza in a poem often signals a shift — perhaps in time, place, mood, or idea.\n\nIt's a misconception to think stanza breaks are random. They're not — poets choose exactly where to break a stanza for a reason. For example, if a poem describes a calm, peaceful scene for two long stanzas, and then suddenly has one very short stanza, that short stanza is likely to signal an important change — perhaps a sudden event, or a shift to a darker mood.\n\nPoets also use two techniques within lines to control pace: enjambment and caesura. Enjambment is when a sentence or phrase continues from one line to the next without a pause, forcing the reader to move quickly onward to complete the sense of the sentence. This can create a feeling of momentum, or of thoughts tumbling out urgently.\n\nCaesura is the opposite in some ways — it's a deliberate pause within a single line, often marked by punctuation like a comma, dash, or full stop. A caesura slows the reader down and can create a moment of reflection, hesitation, or emphasis.\n\nIt's important not to confuse enjambment with simply 'a long sentence'. Enjambment specifically refers to a sentence continuing across a line break with no punctuation at the end of the line — it's about how the poem is laid out on the page, not just about sentence length.\n\nToday, we'll look at how structure — stanza length, enjambment and caesura — shapes the meaning and pace of a poem, using a poem we'll read together.",
            starterQuiz: [
              { kind: "mc", question: "What is a stanza similar to in prose writing?", correct: ["A paragraph"], distractors: ["A sentence", "A chapter", "A footnote"] },
              { kind: "mc", question: "What is enjambment?", correct: ["A sentence running on from one line to the next without a pause"], distractors: ["A pause within a line", "A rhyme at the end of a line", "A repeated word"] },
              { kind: "short", question: "What do we call a deliberate pause within a line of poetry?", answers: ["caesura"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "A sudden, very short stanza after several long stanzas is most likely to signal...", correct: ["an important shift or change"], distractors: ["a printing error", "the end of the poem only", "nothing significant"] },
              { kind: "mc", question: "Which of these are structural features of a poem? (select all that apply)", correct: ["enjambment", "caesura"], distractors: ["simile", "alliteration"] },
              { kind: "short", question: "What is a group of lines forming a unit within a poem called?", answers: ["stanza"] },
              { kind: "match", question: "Match each term to its definition.", pairs: [["stanza", "a group of lines forming a unit"], ["enjambment", "a sentence running over a line break"], ["caesura", "a pause within a line"]] },
              { kind: "order", question: "Order these from most flowing/fast-paced to most paused/slow: strong enjambment, no enjambment or caesura, frequent caesura.", items: ["strong enjambment", "no enjambment or caesura", "frequent caesura"] },
            ],
            worksheet: [
              { text: "What effect might enjambment create for the reader?", type: "extended" },
              { text: "What punctuation is often used to create a caesura?", type: "short", answer: "a comma or dash" },
              { text: "Explain why a poet might use a very short stanza after several long ones.", type: "extended" },
              { text: "What is a stanza?", type: "short", answer: "a group of lines forming a unit in a poem" },
            ],
          },
          {
            slug: "analysing-word-choice-in-poetry",
            title: "Analysing word choice in poetry",
            pupilLessonOutcome: "I can analyse a poet's word choices and explain their effect on the reader.",
            keyLearningPoints: [
              "Poets choose individual words very deliberately for their precise meaning and connotation.",
              "Analysis should explain the effect of a word choice, not just identify or describe it.",
              "Sound devices such as alliteration and onomatopoeia can reinforce a word's meaning.",
              "The 'point, evidence, explain' structure helps organise clear analytical writing about language.",
            ],
            keywords: [
              { keyword: "alliteration", description: "The repetition of the same consonant sound at the start of nearby words, e.g. 'the wild wind whispered'." },
              { keyword: "onomatopoeia", description: "A word that imitates the sound it describes, e.g. 'crash', 'buzz', 'hiss'." },
              { keyword: "analyse", description: "To explain in detail how and why a writer's choices create a particular effect on the reader." },
            ],
            misconceptions: [
              { misconception: "Pupils identify a technique (e.g. 'this is alliteration') without explaining its effect.", response: "Model the difference between spotting a technique and analysing it: 'this is alliteration' is identification; explaining that the repeated sound mimics wind and makes the description feel more immersive is analysis." },
              { misconception: "Pupils think there is only one 'correct' interpretation of a word choice.", response: "Show that thoughtful analytical writing can offer more than one valid interpretation, as long as it is supported by evidence from the text." },
            ],
            teacherTips: [
              "Use sentence starters like 'This suggests...' or 'This creates an effect of...' to push pupils from identification into explanation.",
              "Model close analysis of a single word choice in detail before asking pupils to attempt a whole line independently.",
            ],
            transcript:
              "Over this unit we've explored rhyme, rhythm and structure. Today we're focusing on the smallest building block of a poem: individual word choices, and how to analyse them.\n\nPoets choose their words extremely deliberately. Every single word in a well-crafted poem has been considered for its precise meaning and its connotation — the feeling or idea it suggests beyond its literal meaning. When we analyse poetry, our job is to explain the effect of these choices on the reader, not just to spot them.\n\nLet's look at an example. Imagine a poem describes 'the wild wind whispered through the trees'. First, we might notice the alliteration — the repeated 'w' sound in 'wild wind whispered'. But simply saying 'this is alliteration' is only identification, not analysis. To analyse it properly, we need to explain the effect: the soft, repeated 'w' sound mimics the continuous, breathy sound of wind itself, making the description feel more immersive and realistic — almost as if we can hear the wind as we read.\n\nThis example also uses onomatopoeia — a word that imitates the sound it describes. 'Whispered' doesn't just tell us the wind made a sound; the word itself sounds soft and breathy, reinforcing the meaning through its very sound.\n\nA really useful structure for analytical writing is 'point, evidence, explain', sometimes shortened to PEE. First, make a clear point about the effect the poet creates. Second, give a quotation as evidence. Third, and most importantly, explain in detail how the specific words in that evidence create that effect.\n\nIt's worth remembering there isn't always only one correct interpretation. Poetry can be read in more than one valid way, as long as your interpretation is properly supported with evidence from the text. Today, you'll practise close analysis of word choices in a short poem, focusing on explaining effect, not just spotting technique.",
            starterQuiz: [
              { kind: "mc", question: "What is alliteration?", correct: ["The repetition of the same consonant sound at the start of nearby words"], distractors: ["A word that imitates a sound", "A rhyme at the end of a line", "A pause within a line"] },
              { kind: "mc", question: "What is onomatopoeia?", correct: ["A word that imitates the sound it describes"], distractors: ["A comparison using 'like'", "A repeated consonant sound", "A type of rhyme scheme"] },
              { kind: "short", question: "Give an example of an onomatopoeic word.", answers: ["crash", "buzz", "hiss", "bang", "pop"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "What does 'PEE' stand for in analytical writing?", correct: ["Point, evidence, explain"], distractors: ["Poem, extract, ending", "Point, example, evaluate", "Prose, evidence, effect"] },
              { kind: "mc", question: "Which of these are examples of analysis, rather than just identification? (select all that apply)", correct: ["The repeated 'w' sound mimics the sound of wind, making the scene feel more immersive.", "The onomatopoeic word 'crash' makes the impact feel sudden and violent."], distractors: ["This is alliteration.", "This is onomatopoeia."] },
              { kind: "short", question: "What does 'connotation' mean?", answers: ["the feeling or idea a word suggests beyond its literal meaning"] },
              { kind: "match", question: "Match each technique to its example.", pairs: [["alliteration", "the wild wind whispered"], ["onomatopoeia", "the branch snapped"], ["metaphor", "the moon was a silver coin"]] },
              { kind: "order", question: "Order these steps for analysing a word choice: make a point, give a quotation as evidence, explain the effect.", items: ["make a point", "give a quotation as evidence", "explain the effect"] },
            ],
            worksheet: [
              { text: "Identify the alliteration in this line: 'the silent snow settled softly'.", type: "short", answer: "silent, settled, softly" },
              { text: "Explain the effect of the onomatopoeic word 'crash' in a description of a storm.", type: "extended" },
              { text: "Write a point, evidence, explain paragraph analysing the word 'whispered' in a description of wind.", type: "extended" },
              { text: "What is the difference between identifying a technique and analysing it?", type: "extended" },
            ],
          },
        ],
      },
    ],
  };
