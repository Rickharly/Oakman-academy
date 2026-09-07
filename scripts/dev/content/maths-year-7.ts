import type { SubjectYearSpec } from "./types";

export const mathsYear7: SubjectYearSpec =   {
    subject: { slug: "maths", title: "Maths" },
    programme: {
      sequenceSlug: "maths-secondary",
      yearGroup: 7,
      keyStage: "ks3",
      phase: "secondary",
      title: "Maths — Year 7",
    },
    units: [
      {
        slug: "fractions-and-equivalent-fractions",
        title: "Fractions and equivalent fractions",
        description:
          "Pupils develop a secure understanding of fractions as parts of a whole, learn to generate equivalent fractions, and simplify fractions to their lowest terms.",
        whyThisWhyNow:
          "Building on fraction work from primary school, this unit consolidates fraction notation and equivalence before pupils move on to adding, subtracting and comparing fractions later in the year.",
        priorKnowledge: [
          "Pupils can recognise and write simple fractions, e.g. 1/2, 1/4, 3/4.",
          "Pupils can find fractions of a set of objects or a quantity.",
          "Pupils understand that a fraction represents a part of a whole.",
        ],
        nationalCurriculum: [
          "Use the four operations to carry out calculations involving fractions.",
          "Understand equivalent fractions.",
          "Simplify fractions by cancelling common factors.",
        ],
        lessons: [
          {
            slug: "fractions-as-parts-of-a-whole",
            title: "Understanding fractions as parts of a whole",
            pupilLessonOutcome: "I can represent a fraction as part of a whole and identify the numerator and denominator.",
            keyLearningPoints: [
              "A fraction describes a number of equal parts of a whole, written as numerator/denominator.",
              "The denominator shows how many equal parts the whole is split into; the numerator shows how many of those parts are being counted.",
              "Fractions can represent parts of a shape, a quantity, or a number line position.",
              "The whole must be split into equal-sized parts for the fraction to be valid.",
            ],
            keywords: [
              { keyword: "numerator", description: "The top number of a fraction, showing how many parts are being counted." },
              { keyword: "denominator", description: "The bottom number of a fraction, showing how many equal parts the whole is divided into." },
              { keyword: "equal parts", description: "Parts of a whole that are all exactly the same size." },
            ],
            misconceptions: [
              { misconception: "Pupils think a larger denominator always means a larger fraction.", response: "Show that as the denominator increases (with numerator fixed), each part gets smaller, so the fraction gets smaller, e.g. 1/8 is smaller than 1/2." },
              { misconception: "Pupils believe any shape split into pieces shows fractions, even if the pieces are different sizes.", response: "Emphasise that the parts must be equal in size before we can use fraction notation to describe them." },
            ],
            teacherTips: [
              "Use physical objects (counters, paper strips) to let pupils fold or split wholes into equal parts before introducing the numerator/denominator notation.",
              "Compare unit fractions (1/n) early, since these ground pupils' sense of size before mixed numerators are introduced.",
            ],
            transcript:
              "Hello and welcome to today's maths lesson. We're going to be learning about fractions, and specifically what a fraction actually represents.\n\nA fraction is a way of describing part of a whole. Imagine you have a chocolate bar and you break it into four equal pieces. If you eat one of those pieces, you have eaten one out of four equal parts, which we write as the fraction one quarter, or 1/4.\n\nEvery fraction has two parts. The bottom number is called the denominator. It tells us how many equal parts the whole has been split into. The top number is called the numerator. It tells us how many of those equal parts we are talking about. So in 3/4, the denominator, 4, tells us the whole has been split into four equal parts, and the numerator, 3, tells us we are talking about three of those parts.\n\nIt's really important that the parts are equal in size. If I cut a pizza into four pieces but one piece is huge and the other three are tiny, I can't use fraction notation to describe those pieces fairly, because they aren't equal.\n\nFractions don't just describe parts of shapes. They can describe parts of a quantity too — for example, 1/4 of 20 sweets is 5 sweets, because 20 shared into 4 equal groups gives 5 in each group. Fractions can also be shown as a point on a number line. If we draw a line from 0 to 1 and split it into four equal sections, the first mark along is at 1/4, the second at 2/4, the third at 3/4, and the last mark is at 1, or 4/4.\n\nBy the end of today, you should be able to look at a fraction like 5/8 and explain exactly what the 5 and the 8 mean, and you should be able to represent that fraction using a diagram, a quantity, or a number line. Let's get started with some examples.",
            starterQuiz: [
              { kind: "mc", question: "Which of these correctly describes the fraction 3/5?", correct: ["3 out of 5 equal parts"], distractors: ["5 out of 3 equal parts", "3 add 5", "5 minus 3"] },
              { kind: "mc", question: "In the fraction 7/10, what does the number 10 represent?", correct: ["The number of equal parts the whole is split into"], distractors: ["The number of parts being counted", "The total number of wholes", "The value of the fraction"] },
              { kind: "short", question: "What is 1/4 of 20?", answers: ["5"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "What is the numerator in the fraction 2/9?", correct: ["2"], distractors: ["9", "7", "11"] },
              { kind: "mc", question: "Which of these fractions have a denominator of 6? (select all that apply)", correct: ["1/6", "5/6"], distractors: ["1/3", "6/7"] },
              { kind: "short", question: "Write the fraction that represents 3 out of 8 equal parts.", answers: ["3/8"] },
              { kind: "match", question: "Match each fraction to its correct description.", pairs: [["1/2", "One out of two equal parts"], ["1/3", "One out of three equal parts"], ["3/4", "Three out of four equal parts"]] },
              { kind: "order", question: "Order these fractions from smallest to largest: 1/2, 1/8, 1/4.", items: ["1/8", "1/4", "1/2"] },
            ],
            worksheet: [
              { text: "What fraction of the shape is shaded if 3 out of 8 equal parts are coloured in?", type: "short", answer: "3/8" },
              { text: "Calculate 1/5 of 30.", type: "numeric", answer: "6" },
              { text: "Explain, in your own words, why the parts of a whole must be equal before we can describe them using a fraction.", type: "extended" },
              { text: "A pizza is cut into 6 equal slices. Ali eats 2 slices. What fraction of the pizza has Ali eaten?", type: "short", answer: "2/6" },
            ],
          },
          {
            slug: "finding-equivalent-fractions",
            title: "Finding equivalent fractions",
            pupilLessonOutcome: "I can generate equivalent fractions by multiplying or dividing the numerator and denominator by the same number.",
            keyLearningPoints: [
              "Equivalent fractions represent the same value even though they have different numerators and denominators.",
              "Multiplying (or dividing) both the numerator and denominator of a fraction by the same non-zero number produces an equivalent fraction.",
              "Equivalent fractions can be shown to be equal using diagrams or a number line.",
              "Finding a common denominator is a key skill for comparing and adding fractions later on.",
            ],
            keywords: [
              { keyword: "equivalent fractions", description: "Fractions that have different numerators and denominators but represent the same value." },
              { keyword: "multiply", description: "To scale a number up by repeated addition, e.g. multiplying by 2 doubles a number." },
              { keyword: "common denominator", description: "A denominator that is shared by two or more fractions, allowing them to be compared or combined." },
            ],
            misconceptions: [
              { misconception: "Pupils think you can add the same number to the numerator and denominator to find an equivalent fraction.", response: "Demonstrate with a diagram that adding the same number to top and bottom changes the value, e.g. 1/2 is not equivalent to 2/3 even though we added 1 to both parts; only multiplying or dividing keeps the value the same." },
              { misconception: "Pupils multiply only the numerator or only the denominator, not both.", response: "Stress that both numerator and denominator must be scaled by the same factor, otherwise the value of the fraction changes." },
            ],
            teacherTips: [
              "Use fraction walls or bar models so pupils can see visually that 1/2, 2/4 and 4/8 line up exactly.",
              "Encourage pupils to say the scale factor out loud, e.g. 'multiplying by 3', to reinforce that the same operation applies to both numbers.",
            ],
            transcript:
              "In our last lesson we looked at what a fraction represents. Today we're finding equivalent fractions — fractions that look different but have exactly the same value.\n\nLet's start with 1/2. If I take a bar and split it into two equal parts, one shaded part represents 1/2. Now, if I split that same bar into four equal parts instead, I would need to shade two of those four parts to cover the same amount of the bar. So 1/2 and 2/4 cover exactly the same amount — they are equivalent fractions.\n\nHow do we find equivalent fractions without drawing every time? The rule is: multiply the numerator and the denominator by the same number. Starting with 1/2, if I multiply both the numerator and denominator by 2, I get 2/4. If I multiply both by 3 instead, I get 3/6. If I multiply both by 4, I get 4/8. All of these fractions — 1/2, 2/4, 3/6, 4/8 — are equivalent, because we have applied the same scaling to both parts every time.\n\nThis also works in reverse. If we divide both the numerator and denominator by the same number, we also get an equivalent fraction. For example, 6/8 divided by 2 on the top and bottom gives 3/4.\n\nA common mistake is to add the same number to the numerator and denominator instead of multiplying. This does not work — if you add 1 to the top and bottom of 1/2, you get 2/3, which is not the same value as 1/2 at all. Only multiplying or dividing by the same number keeps the fraction's value unchanged.\n\nBeing able to find equivalent fractions is an essential skill, because later we'll need to find a common denominator before we can add or compare fractions with different denominators. Let's practise finding some equivalent fractions together now.",
            starterQuiz: [
              { kind: "mc", question: "What is the denominator in the fraction 5/9?", correct: ["9"], distractors: ["5", "4", "14"] },
              { kind: "mc", question: "Which fraction is equivalent to 1/2?", correct: ["2/4"], distractors: ["1/3", "2/3", "1/4"] },
              { kind: "short", question: "What do you get if you multiply the numerator and denominator of 1/3 by 2?", answers: ["2/6"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "To find an equivalent fraction, you should multiply the numerator and denominator by...", correct: ["the same number"], distractors: ["different numbers", "zero", "the numerator only"] },
              { kind: "mc", question: "Which of these fractions are equivalent to 2/3? (select all that apply)", correct: ["4/6", "6/9"], distractors: ["3/4", "2/6"] },
              { kind: "short", question: "Write a fraction equivalent to 3/5 by multiplying top and bottom by 2.", answers: ["6/10"] },
              { kind: "match", question: "Match each fraction to an equivalent fraction.", pairs: [["1/4", "2/8"], ["2/5", "4/10"], ["3/4", "6/8"]] },
              { kind: "order", question: "Order these steps for finding an equivalent fraction of 2/3: choose a scale factor, multiply the numerator by it, multiply the denominator by it, write the new fraction.", items: ["choose a scale factor", "multiply the numerator by it", "multiply the denominator by it", "write the new fraction"] },
            ],
            worksheet: [
              { text: "Find an equivalent fraction to 1/3 by multiplying the numerator and denominator by 4.", type: "short", answer: "4/12" },
              { text: "Is 3/6 equivalent to 1/2? Explain how you know.", type: "extended" },
              { text: "Divide the numerator and denominator of 8/12 by 4. What fraction do you get?", type: "short", answer: "2/3" },
              { text: "Write two fractions that are equivalent to 2/5.", type: "extended" },
            ],
          },
          {
            slug: "simplifying-fractions",
            title: "Simplifying fractions to their lowest terms",
            pupilLessonOutcome: "I can simplify a fraction to its lowest terms by dividing the numerator and denominator by their highest common factor.",
            keyLearningPoints: [
              "A fraction is in its simplest form (lowest terms) when the numerator and denominator share no common factor other than 1.",
              "To simplify a fraction, divide both the numerator and denominator by a common factor.",
              "Dividing by the highest common factor simplifies a fraction in one step.",
              "Simplifying a fraction does not change its value, only how it is written.",
            ],
            keywords: [
              { keyword: "simplify", description: "To write a fraction using the smallest possible numerator and denominator while keeping the same value." },
              { keyword: "common factor", description: "A number that divides exactly into two or more other numbers." },
              { keyword: "highest common factor", description: "The largest number that divides exactly into two or more numbers." },
            ],
            misconceptions: [
              { misconception: "Pupils think a fraction is only simplified if the numerator is 1.", response: "Show examples like 4/6 simplifying to 2/3, where the simplified numerator is not 1, to demonstrate that 'simplest form' just means no common factor remains, not that the numerator must be 1." },
              { misconception: "Pupils stop simplifying too early, dividing by a common factor that isn't the highest one.", response: "Model checking the result again after each division to see if a further common factor still exists, e.g. 8/12 → 4/6 (still has common factor 2) → 2/3." },
            ],
            teacherTips: [
              "Encourage pupils to list factors of the numerator and denominator to spot the highest common factor before dividing.",
              "Link simplifying back to equivalent fractions from the previous lesson — simplifying is just finding an equivalent fraction with smaller numbers.",
            ],
            transcript:
              "Today we're building on equivalent fractions to learn how to simplify a fraction — writing it using the smallest possible numbers while keeping exactly the same value.\n\nLet's look at the fraction 6/8. Both 6 and 8 can be divided by 2. If we divide the numerator, 6, by 2, we get 3. If we divide the denominator, 8, by 2, we get 4. So 6/8 simplifies to 3/4. These two fractions have the same value — we've just written it using smaller numbers.\n\nHow do we know when a fraction is fully simplified? A fraction is in its simplest form, or lowest terms, when the numerator and denominator share no common factor other than 1. Let's check 3/4: the factors of 3 are 1 and 3; the factors of 4 are 1, 2 and 4. The only factor they share is 1, so 3/4 cannot be simplified any further.\n\nSometimes a fraction needs more than one step. Take 8/12. Both numbers can be divided by 2, giving 4/6. But 4 and 6 can still both be divided by 2, giving 2/3. Now the factors of 2 are 1 and 2, and the factors of 3 are 1 and 3 — the only shared factor is 1, so we've reached the simplest form.\n\nA quicker way is to find the highest common factor of the numerator and denominator straight away, then divide by that in one step. For 8 and 12, the highest common factor is 4, so dividing both by 4 immediately gives 2/3 — the same answer, in one step instead of two.\n\nA common mistake is thinking a fraction is only fully simplified if the numerator is 1. That's not true — 2/3 is fully simplified even though the numerator is 2, because 2 and 3 share no common factor. Let's practise simplifying some fractions together now.",
            starterQuiz: [
              { kind: "mc", question: "What are the factors of 8?", correct: ["1, 2, 4, 8"], distractors: ["1, 3, 8", "2, 4, 6, 8", "1, 8"] },
              { kind: "mc", question: "Which fraction is equivalent to 4/8?", correct: ["1/2"], distractors: ["2/3", "1/4", "3/4"] },
              { kind: "short", question: "Divide the numerator and denominator of 4/8 by 4. What fraction do you get?", answers: ["1/2"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "A fraction is in its simplest form when the numerator and denominator share no common factor other than...", correct: ["1"], distractors: ["2", "0", "the denominator"] },
              { kind: "mc", question: "Which of these fractions are already in their simplest form? (select all that apply)", correct: ["3/5", "2/3"], distractors: ["4/8", "6/9"] },
              { kind: "short", question: "Simplify 9/12 to its lowest terms.", answers: ["3/4"] },
              { kind: "match", question: "Match each fraction to its simplified form.", pairs: [["6/8", "3/4"], ["4/10", "2/5"], ["10/15", "2/3"]] },
              { kind: "order", question: "Order the steps for simplifying 12/16: find the highest common factor, divide the numerator by it, divide the denominator by it, write the simplified fraction.", items: ["find the highest common factor", "divide the numerator by it", "divide the denominator by it", "write the simplified fraction"] },
            ],
            worksheet: [
              { text: "Simplify 10/15 to its lowest terms.", type: "short", answer: "2/3" },
              { text: "What is the highest common factor of 12 and 18?", type: "numeric", answer: "6" },
              { text: "Explain why 5/9 cannot be simplified any further.", type: "extended" },
              { text: "Simplify 14/21 to its lowest terms.", type: "short", answer: "2/3" },
            ],
          },
        ],
      },
      {
        slug: "introduction-to-algebra",
        title: "Introduction to algebra",
        description:
          "Pupils are introduced to algebraic notation, learn to simplify expressions by collecting like terms, and substitute numerical values into expressions.",
        whyThisWhyNow:
          "Algebra is a foundational topic for the rest of secondary mathematics; this unit builds pupils' fluency with symbols before they meet equations and formulae.",
        priorKnowledge: [
          "Pupils can use the four operations (+, -, ×, ÷) with whole numbers.",
          "Pupils understand the concept of an unknown quantity, e.g. missing number problems.",
          "Pupils can evaluate simple numerical expressions using the correct order of operations.",
        ],
        nationalCurriculum: [
          "Use and interpret algebraic notation.",
          "Simplify and manipulate algebraic expressions by collecting like terms.",
          "Substitute numerical values into formulae and expressions.",
        ],
        lessons: [
          {
            slug: "letters-to-represent-unknown-numbers",
            title: "Using letters to represent unknown numbers",
            pupilLessonOutcome: "I can use a letter to represent an unknown number and write simple algebraic expressions.",
            keyLearningPoints: [
              "In algebra, a letter (such as x or n) stands in for a number we don't yet know or that can vary.",
              "'n + 5' means 'a number, plus 5'; the letter can represent any value unless we're told otherwise.",
              "We write multiplication without the × sign in algebra, e.g. 3 × n is written 3n.",
              "Algebraic expressions let us describe general rules and patterns concisely.",
            ],
            keywords: [
              { keyword: "variable", description: "A letter used in algebra to represent a number that can change or is not yet known." },
              { keyword: "expression", description: "A collection of numbers, letters and operations, e.g. 3n + 2, that does not contain an equals sign." },
              { keyword: "term", description: "A single number, variable, or the product of numbers and variables, within an expression." },
            ],
            misconceptions: [
              { misconception: "Pupils think a letter in algebra always represents the same fixed number, like a code to crack.", response: "Explain that a variable can represent any number depending on the context; sometimes it is unknown and fixed (as in an equation), and sometimes it varies (as in a formula)." },
              { misconception: "Pupils write '3 × n' as '3 × n' or 'n3' instead of '3n'.", response: "Model the convention clearly: in algebra we write the number before the letter with no multiplication sign, e.g. 3n, not n3 or 3 × n." },
            ],
            teacherTips: [
              "Link algebraic expressions to real contexts, e.g. 'the cost of n pencils at 20p each is 20n pence', to make the abstraction concrete.",
              "Address the 3n vs n3 convention explicitly and repeatedly, as it is a very common early error.",
            ],
            transcript:
              "Welcome to our first lesson on algebra. Algebra might look mysterious at first because it uses letters instead of numbers, but really, a letter is just standing in for a number that we don't know yet, or a number that can change.\n\nLet's imagine I have a bag of marbles, but I don't know how many are inside. Instead of guessing a number, I can call the number of marbles 'n'. If someone gives me 3 more marbles, I now have 'n + 3' marbles. This expression, n + 3, describes the total number of marbles whatever n turns out to be. If n was 5, I'd have 8 marbles. If n was 10, I'd have 13 marbles. The expression works for any value of n.\n\nWe call a letter used this way a variable, because its value can vary. A group of numbers and variables joined by operations, like n + 3, is called an expression. Notice an expression does not have an equals sign — it's just a description, not a statement that two things are equal.\n\nNow let's look at multiplication in algebra. If I want to describe three times a number n, mathematicians don't write '3 × n'. Instead, we drop the multiplication sign and simply write '3n'. So 3n means 'three lots of n', or 'n multiplied by 3'. This is just a convention — a way mathematicians agree to write things — but it's really important to get right, because if you write it the wrong way round, like n3, it can be read as an entirely different thing.\n\nAlgebra becomes really powerful because a single expression can describe a whole pattern or rule at once, instead of us having to write out lots of separate number examples. Over the next few lessons we'll learn to simplify expressions and substitute numbers into them. Let's start practising writing some simple expressions now.",
            starterQuiz: [
              { kind: "mc", question: "What do we call a letter used in algebra to represent a number?", correct: ["a variable"], distractors: ["an operator", "a constant", "an equation"] },
              { kind: "mc", question: "How do we write 'three times n' in algebra?", correct: ["3n"], distractors: ["n3", "3 × n only", "n + 3"] },
              { kind: "short", question: "Write an expression for 'a number, x, plus 7'.", answers: ["x + 7", "x+7"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "Which of these is an algebraic expression?", correct: ["2n + 5"], distractors: ["2 + 5 = 7", "n = 3", "5 × 5"] },
              { kind: "mc", question: "Which of these are examples of a variable? (select all that apply)", correct: ["x", "n"], distractors: ["5", "+"] },
              { kind: "short", question: "Write 'five times a number, y' using correct algebraic notation.", answers: ["5y"] },
              { kind: "match", question: "Match each word description to its algebraic expression.", pairs: [["a number plus 4", "n + 4"], ["three times a number", "3n"], ["a number minus 2", "n - 2"]] },
              { kind: "order", question: "Order these from fewest to most terms: 5, n, n + 5.", items: ["5", "n", "n + 5"] },
            ],
            worksheet: [
              { text: "Write an expression for 'a number, m, plus 9'.", type: "short", answer: "m + 9" },
              { text: "Write 'four times a number, p' using correct algebraic notation.", type: "short", answer: "4p" },
              { text: "Explain what a variable is, using an example.", type: "extended" },
              { text: "A café charges 20p per cup of tea, t. Write an expression for the total cost in pence.", type: "short", answer: "20t" },
            ],
          },
          {
            slug: "collecting-like-terms",
            title: "Simplifying algebraic expressions by collecting like terms",
            pupilLessonOutcome: "I can simplify an algebraic expression by collecting like terms.",
            keyLearningPoints: [
              "Like terms contain exactly the same variable (or combination of variables), e.g. 3x and 5x are like terms.",
              "We simplify an expression by adding or subtracting the coefficients of like terms.",
              "Unlike terms, such as 3x and 3y, cannot be combined into a single term.",
              "Collecting like terms does not change the value of an expression, only how it is written.",
            ],
            keywords: [
              { keyword: "like terms", description: "Terms that contain the same variable(s), e.g. 4x and 7x." },
              { keyword: "coefficient", description: "The number multiplying a variable in a term, e.g. the coefficient of 5x is 5." },
              { keyword: "simplify", description: "To rewrite an expression in a shorter, equivalent form by combining like terms." },
            ],
            misconceptions: [
              { misconception: "Pupils combine unlike terms, e.g. saying 3x + 2y = 5xy.", response: "Show with real quantities (e.g. 3 apples + 2 bananas is not 5 'apple-bananas') that only terms with the exact same variable can be combined." },
              { misconception: "Pupils forget that a lone variable like x has an invisible coefficient of 1, e.g. treating x + x as 'x' instead of 2x.", response: "Explicitly write x as 1x when first collecting like terms, so pupils see 1x + 1x = 2x clearly." },
            ],
            teacherTips: [
              "Use coloured counters or shapes to represent different variables, so pupils can physically group 'like' items before collecting like terms symbolically.",
              "Get pupils to underline or colour-code like terms in a longer expression before they start combining them.",
            ],
            transcript:
              "Last lesson we learned to write algebraic expressions using variables. Today we're learning how to simplify expressions by collecting like terms.\n\nLike terms are terms that contain exactly the same variable. For example, 3x and 5x are like terms, because they both contain the variable x. But 3x and 3y are not like terms, because one has x and the other has y — they represent different things.\n\nLet's simplify the expression 3x + 5x. Since both terms have the variable x, we can combine them by adding the numbers in front, which are called coefficients. Three lots of x, plus five lots of x, gives us eight lots of x, so 3x + 5x simplifies to 8x.\n\nWhat about an expression like 4x + 3y + 2x? Here we have two different variables, x and y. We can only combine the like terms — the x terms. 4x and 2x are like terms, so they combine to 6x. The 3y term is unlike the others, so it stays on its own. The simplified expression is 6x + 3y.\n\nA common mistake is to combine terms that are not alike, for example thinking 3x + 2y equals 5xy. This is incorrect — imagine x represents apples and y represents bananas. Three apples plus two bananas doesn't become five 'apple-bananas'; they stay as three apples and two bananas, or in algebra, 3x + 2y, unless there's more information linking them.\n\nAnother thing to watch for is a lone variable on its own, like x. This actually means 1x, so x + x is the same as 1x + 1x, which simplifies to 2x, not just x.\n\nCollecting like terms doesn't change the value of the expression — it's still describing exactly the same amount — it just writes it more simply. Let's practise collecting like terms in some expressions together now.",
            starterQuiz: [
              { kind: "mc", question: "Which pair of terms are 'like terms'?", correct: ["4x and 9x"], distractors: ["4x and 9y", "4x and 9", "4 and 9y"] },
              { kind: "mc", question: "What do we call the number in front of a variable, e.g. the 5 in 5x?", correct: ["coefficient"], distractors: ["variable", "exponent", "operator"] },
              { kind: "short", question: "Simplify: 2x + 3x.", answers: ["5x"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "Simplify: 6x + 2x.", correct: ["8x"], distractors: ["8x^2", "6x2", "4x"] },
              { kind: "mc", question: "Which of these expressions contain a pair of like terms that could be collected? (select all that apply)", correct: ["3x + 5x + y", "4a + 2a + b"], distractors: ["3x + 5y", "2a + 3b"] },
              { kind: "short", question: "Simplify: 7y + 2y - 3y.", answers: ["6y"] },
              { kind: "match", question: "Match each expression to its simplified form.", pairs: [["3x + 4x", "7x"], ["5y - 2y", "3y"], ["2a + a", "3a"]] },
              { kind: "order", question: "Order the steps for simplifying 4x + 3y + 2x: identify the like terms, add their coefficients, write the final simplified expression.", items: ["identify the like terms", "add their coefficients", "write the final simplified expression"] },
            ],
            worksheet: [
              { text: "Simplify: 5x + 3x.", type: "short", answer: "8x" },
              { text: "Simplify: 6a + 2b + 3a.", type: "short", answer: "9a + 2b" },
              { text: "Explain why 4x and 4y are not like terms.", type: "extended" },
              { text: "Simplify: 8y - 3y + y.", type: "short", answer: "6y" },
            ],
          },
          {
            slug: "substituting-values-into-expressions",
            title: "Substituting values into expressions",
            pupilLessonOutcome: "I can substitute given numerical values into an algebraic expression and evaluate it.",
            keyLearningPoints: [
              "Substitution means replacing a variable in an expression with a given number.",
              "After substituting, we use the correct order of operations to work out the value of the expression.",
              "The same expression gives a different value depending on the number substituted.",
              "Substitution is used to check whether a value satisfies a formula or a rule.",
            ],
            keywords: [
              { keyword: "substitute", description: "To replace a variable in an expression with a specific numerical value." },
              { keyword: "evaluate", description: "To work out the numerical value of an expression." },
              { keyword: "order of operations", description: "The agreed sequence for carrying out calculations: brackets, indices, multiplication/division, addition/subtraction." },
            ],
            misconceptions: [
              { misconception: "Pupils substitute the value but then don't apply the correct order of operations, e.g. calculating 2 + 3x with x=4 as (2+3)×4 instead of 2+(3×4).", response: "Remind pupils that multiplication between a coefficient and a variable happens first, before any addition or subtraction, exactly as in numerical order of operations." },
              { misconception: "Pupils think substituting a negative number only affects the sign of the final answer, applying it inconsistently.", response: "Work through an example carefully with a negative substitution, e.g. x = -2 in 3x, showing 3 × (-2) = -6." },
            ],
            teacherTips: [
              "Always have pupils rewrite the expression with the number substituted in brackets before calculating, e.g. 3x becomes 3 × (4), to avoid sign and order-of-operation errors.",
              "Use real-world formulae, such as calculating cost or distance, to show why substitution matters in practice.",
            ],
            transcript:
              "In our previous two lessons, we learned to write algebraic expressions and to simplify them by collecting like terms. Today, we're learning how to substitute a number into an expression to find its value.\n\nSubstitution means replacing a variable with a specific number. Let's take the expression 3x + 2. If we're told that x = 4, we substitute 4 in place of x, giving us 3 × 4 + 2. Following the order of operations, we do the multiplication first: 3 × 4 = 12. Then we add 2, giving us a final answer of 14. So when x = 4, the expression 3x + 2 has a value of 14.\n\nIt's really important to remember the order of operations when substituting. In the expression 2 + 3x, if x = 5, we must calculate 3 × 5 first, which is 15, and then add 2, giving 17. It would be wrong to add 2 and 3 first — the multiplication between the coefficient and the variable always happens before addition or subtraction.\n\nThe same expression will give a different answer depending on what number we substitute. If we used the expression 3x + 2 again, but this time x = 10, we'd get 3 × 10 + 2, which is 30 + 2, equalling 32 — a completely different answer to when x was 4.\n\nWe also need to take care when substituting negative numbers. If x = -2 in the expression 3x, we calculate 3 × (-2), which gives -6. A helpful habit is to always write the substituted number in brackets before calculating, especially with negative numbers, so you don't lose track of the sign.\n\nSubstitution is a really useful skill because it lets us check formulae and rules with real numbers — for example, working out the cost of buying a certain number of items, or the perimeter of a shape with a given side length. Let's practise substituting some values now.",
            starterQuiz: [
              { kind: "mc", question: "What does 'substitute' mean in algebra?", correct: ["replace a variable with a given number"], distractors: ["simplify an expression", "add two expressions together", "remove a variable"] },
              { kind: "mc", question: "For 2 + 3x, once x is substituted, which operation happens first?", correct: ["multiply, then add"], distractors: ["add, then multiply", "divide first", "subtract first"] },
              { kind: "short", question: "If x = 5, what is the value of 2x?", answers: ["10"] },
            ],
            exitQuiz: [
              { kind: "mc", question: "If x = 3, what is the value of 4x + 1?", correct: ["13"], distractors: ["16", "12", "7"] },
              { kind: "mc", question: "Which of these expressions equal 10 when x = 2? (select all that apply)", correct: ["3x + 4", "5x"], distractors: ["2x + 1", "x + 4"] },
              { kind: "short", question: "If y = 6, what is the value of 2y - 5?", answers: ["7"] },
              { kind: "match", question: "Match each expression (with x = 4) to its correct value.", pairs: [["3x", "12"], ["x + 5", "9"], ["2x - 1", "7"]] },
              { kind: "order", question: "Order the steps for evaluating 5x - 2 when x = 3: substitute x with 3, multiply 5 by 3, subtract 2 from the result.", items: ["substitute x with 3", "multiply 5 by 3", "subtract 2 from the result"] },
            ],
            worksheet: [
              { text: "If x = 6, find the value of 2x + 3.", type: "numeric", answer: "15" },
              { text: "If a = 4, find the value of 5a - 2.", type: "numeric", answer: "18" },
              { text: "Explain why the order of operations matters when substituting a value into 2 + 3x.", type: "extended" },
              { text: "If x = -2, find the value of 4x.", type: "numeric", answer: "-8" },
            ],
          },
        ],
      },
    ],
  };
