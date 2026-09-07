import type { SubjectYearSpec } from "./types";

export const mathsYear5: SubjectYearSpec = {
  subject: { slug: "maths", title: "Maths" },
  programme: {
    sequenceSlug: "maths-primary",
    yearGroup: 5,
    keyStage: "ks2",
    phase: "primary",
    title: "Maths — Year 5",
  },
  units: [
    {
      slug: "fractions",
      title: "Fractions",
      description:
        "Pupils compare and order fractions with the same denominator, add and subtract fractions with the same denominator, and find fractions of amounts and sets of objects.",
      whyThisWhyNow:
        "This unit builds directly on pupils' Year 4 work on equivalent fractions and simple addition, preparing them for calculating with fractions that have different denominators in Year 6.",
      priorKnowledge: [
        "Pupils can recognise and write fractions with the same denominator, e.g. 2/5 and 4/5.",
        "Pupils understand that the denominator shows how many equal parts a whole is split into.",
        "Pupils can find unit fractions of small quantities, e.g. 1/2 of 10.",
      ],
      nationalCurriculum: [
        "Compare and order fractions whose denominators are all multiples of the same number.",
        "Add and subtract fractions with the same denominator, and denominators that are multiples of the same number.",
        "Recognise, find and write fractions of a discrete set of objects: unit fractions and non-unit fractions with small denominators.",
      ],
      lessons: [
        {
          slug: "comparing-and-ordering-fractions",
          title: "Comparing and ordering fractions",
          pupilLessonOutcome: "I can compare and order fractions that have the same denominator.",
          keyLearningPoints: [
            "When fractions have the same denominator, the fraction with the larger numerator is the larger fraction.",
            "Fractions with the same denominator have equal-sized parts, so only the numerator changes how much we have.",
            "We use the symbols < (less than) and > (greater than) to compare two fractions.",
            "To order a list of fractions with the same denominator, we order their numerators.",
          ],
          keywords: [
            { keyword: "numerator", description: "The top number of a fraction; it shows how many equal parts we have." },
            { keyword: "denominator", description: "The bottom number of a fraction; it shows how many equal parts the whole has been split into." },
            { keyword: "order", description: "To arrange numbers from smallest to largest, or largest to smallest." },
          ],
          misconceptions: [
            { misconception: "Pupils assume that if the denominators are the same, the fractions must be equal, and don't look at the numerators at all.", response: "Show that when the denominator is fixed, only the numerator changes the fraction's size — e.g. 2/6 and 5/6 both have sixths, but 5/6 has more of them, so 5/6 is bigger." },
            { misconception: "When ordering fractions, pupils muddle the < and > symbols and read them the wrong way round.", response: "Teach the trick that the symbol always opens towards the bigger amount, like a crocodile's mouth opening towards the food it wants to eat most." },
          ],
          teacherTips: [
            "Use fraction strips or bars of the same length split into the same number of parts so pupils can see directly that more shaded parts means a bigger fraction.",
            "Get pupils to say the fraction in words ('three eighths', 'five eighths') before comparing, so they focus on the numerator as 'how many'.",
          ],
          transcript:
            "Hello! Today we're comparing fractions, working out which fraction is bigger and which is smaller, when the fractions have the same denominator.\n\nLet's imagine two chocolate bars, both cut into eight equal pieces. On the first bar, three pieces are chocolate icing. On the second bar, five pieces are chocolate icing. Which bar has more icing? The second one, because five pieces is more than three pieces.\n\nWe can write this using fractions: 3/8 and 5/8. Both fractions have the same denominator, 8, which means both bars have been split into eight equal-sized pieces. Because the pieces are exactly the same size, we don't need to think about the denominator at all when comparing — we just look at the numerator, the top number, to see how many of those pieces we have. Five is more than three, so 5/8 is bigger than 3/8. We can write this as 5/8 > 3/8, or 3/8 < 5/8.\n\nThis little arrow, the greater than or less than sign, always opens towards the bigger number, like a hungry crocodile's mouth opening towards more food. So 3/8 < 5/8 shows the narrow point at 3/8 and the wide open end at 5/8.\n\nNow, what if we want to order more than two fractions with the same denominator? Say we have 2/6, 5/6 and 1/6. Since the denominator is the same for all three, we simply order the numerators: 1, then 2, then 5. So from smallest to largest, the fractions in order are 1/6, 2/6, 5/6.\n\nHere's the mistake to watch for. Some people see two fractions with the same denominator and think that because the bottom numbers match, that's all that matters. But it's the top number, the numerator, that tells us how big the fraction is, once the denominator is the same for both.\n\nNext, you'll practise comparing and ordering fractions with the same denominator yourself, using the greater than and less than signs.",
          starterQuiz: [
            { kind: "mc", question: "What does the denominator of a fraction tell us?", correct: ["How many equal parts the whole is split into"], distractors: ["How many parts we are counting", "The total value of the fraction", "Whether the fraction is more or less than one"] },
            { kind: "mc", question: "Which fraction shows 3 out of 5 equal parts?", correct: ["3/5"], distractors: ["5/3", "3/2", "2/5"] },
            { kind: "short", question: "What is 1/2 of 10?", answers: ["5"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "Which fraction is bigger, 4/9 or 7/9?", correct: ["7/9"], distractors: ["4/9", "They are equal", "Cannot be compared"] },
            { kind: "mc", question: "If two fractions have the same denominator, which number do we compare to find out which is bigger?", correct: ["The numerator"], distractors: ["The denominator", "Both numbers added together", "Neither number"] },
            { kind: "short", question: "Write the missing symbol to make this true: 2/7 ___ 5/7 (use < or >)", answers: ["<"] },
            { kind: "match", question: "Match each pair of fractions to the correct comparison.", pairs: [["3/8 and 6/8", "6/8 is greater"], ["5/10 and 2/10", "5/10 is greater"], ["1/4 and 3/4", "3/4 is greater"]] },
            { kind: "order", question: "Order these fractions from smallest to largest: 5/9, 1/9, 4/9.", items: ["1/9", "4/9", "5/9"] },
          ],
          worksheet: [
            { text: "Which is bigger, 3/7 or 6/7?", type: "short", answer: "6/7" },
            { text: "Order these fractions from largest to smallest: 2/5, 4/5, 1/5.", type: "short", answer: "4/5, 2/5, 1/5" },
            { text: "Write < or > to make this true: 5/12 ___ 9/12.", type: "short", answer: "<" },
            { text: "Explain, in your own words, why we only need to look at the numerator when comparing fractions that have the same denominator.", type: "extended", answer: "A good answer says that when the denominator is the same, the parts are already the same size, so the numerator alone tells us how many of those equal parts we have, and therefore which fraction is bigger." },
          ],
        },
        {
          slug: "adding-and-subtracting-fractions-same-denominator",
          title: "Adding and subtracting fractions with the same denominator",
          pupilLessonOutcome: "I can add and subtract fractions that have the same denominator.",
          keyLearningPoints: [
            "To add fractions with the same denominator, add the numerators and keep the denominator the same.",
            "To subtract fractions with the same denominator, subtract the numerators and keep the denominator the same.",
            "The denominator does not change when adding or subtracting, because the size of the parts stays the same.",
            "If the numerators add up to more than the denominator, the answer is greater than one whole, and can be written as a mixed number.",
          ],
          keywords: [
            { keyword: "mixed number", description: "A number made of a whole number and a fraction together, e.g. 1 1/4." },
            { keyword: "numerator", description: "The top number of a fraction, showing how many parts we have." },
            { keyword: "denominator", description: "The bottom number of a fraction, showing the size of each equal part." },
          ],
          misconceptions: [
            { misconception: "Pupils add both the numerators and the denominators, e.g. saying 1/4 + 2/4 = 3/8.", response: "Show with a diagram that the parts are still quarters, not eighths — adding the denominators would make the parts a different size, which doesn't happen just because we combine amounts; only the numerators are added." },
            { misconception: "Pupils don't recognise that an answer like 5/4 is bigger than one whole, and either leave it as a strange-looking fraction or think it must be wrong.", response: "Model converting 5/4 into the mixed number 1 1/4 using a diagram of one whole plus one extra quarter, so pupils see it is a perfectly good answer, just written differently." },
          ],
          teacherTips: [
            "Use pizza or bar diagrams split into the given denominator so pupils can see physically that combining parts keeps the same-sized slices.",
            "Encourage pupils to say the calculation in words first, e.g. 'two fifths plus one fifth', to reinforce that the denominator names the type of part, like a unit.",
          ],
          transcript:
            "Hello again! Today we're adding and subtracting fractions, where both fractions have the same denominator.\n\nPicture a pizza cut into five equal slices. If you eat two slices, you've eaten 2/5 of the pizza. If your friend then eats one more slice, together you've eaten 2/5 plus 1/5. How many slices have you eaten altogether? Three slices, out of the five the pizza was cut into. So 2/5 + 1/5 = 3/5.\n\nNotice what happened. We added the numerators, 2 and 1, to get 3. But the denominator stayed as 5, because the pizza is still cut into fifths — the size of each slice hasn't changed, only how many slices we've eaten. This is the golden rule: when adding or subtracting fractions with the same denominator, add or subtract the numerators, and keep the denominator exactly the same.\n\nSubtracting works the same way. If you had 4/6 of a chocolate bar and you gave away 1/6, you'd subtract the numerators: 4 take away 1 is 3, so you'd have 3/6 left. The denominator stays as 6 throughout.\n\nSometimes, when we add, the numerator ends up bigger than the denominator. Imagine eating 3/4 of one pizza, then 2/4 more from a second identical pizza. That's 3/4 + 2/4, and adding the numerators gives us 5/4. But 5/4 is more than one whole pizza! We can write this as a mixed number instead: one whole pizza, plus one quarter left over, which is 1 1/4.\n\nThe mistake to avoid is adding the denominators too, so writing 1/4 + 2/4 as 3/8. That's wrong, because the slices are still quarters, not eighths.\n\nNow it's your turn to practise adding and subtracting fractions with the same denominator.",
          starterQuiz: [
            { kind: "mc", question: "In the fraction 5/8, what does the number 5 represent?", correct: ["The numerator, how many parts we have"], distractors: ["The denominator, how many parts the whole is split into", "The total number of wholes", "The value of one part"] },
            { kind: "mc", question: "Which fraction is bigger, 2/7 or 5/7?", correct: ["5/7"], distractors: ["2/7", "They are equal", "Cannot tell"] },
            { kind: "short", question: "What is 4 + 3?", answers: ["7"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is 2/5 + 1/5?", correct: ["3/5"], distractors: ["3/10", "2/10", "1/5"] },
            { kind: "mc", question: "What is 5/6 - 2/6?", correct: ["3/6"], distractors: ["3/12", "7/6", "3/0"] },
            { kind: "short", question: "Write 4/3 as a mixed number.", answers: ["1 1/3", "1 and 1/3"] },
            { kind: "match", question: "Match each calculation to its answer.", pairs: [["1/8 + 3/8", "4/8"], ["7/9 - 4/9", "3/9"], ["2/6 + 3/6", "5/6"]] },
            { kind: "order", question: "Put these steps in order for adding fractions with the same denominator: check the denominators are the same, add the numerators together, keep the denominator the same, write the answer as a fraction.", items: ["check the denominators are the same", "add the numerators together", "keep the denominator the same", "write the answer as a fraction"] },
          ],
          worksheet: [
            { text: "Work out 3/7 + 2/7.", type: "short", answer: "5/7" },
            { text: "Work out 6/8 - 3/8.", type: "short", answer: "3/8" },
            { text: "Work out 4/5 + 3/5, and write your answer as a mixed number.", type: "short", answer: "1 2/5" },
            { text: "Explain why the denominator does not change when we add two fractions with the same denominator.", type: "extended", answer: "A good answer explains that the denominator shows the size of the parts, and adding fractions only combines how many parts we have (the numerators) without changing how big each part is, so the denominator stays the same." },
          ],
        },
        {
          slug: "finding-fractions-of-amounts",
          title: "Finding fractions of amounts",
          pupilLessonOutcome: "I can find a fraction of an amount by dividing by the denominator and multiplying by the numerator.",
          keyLearningPoints: [
            "To find a fraction of an amount, first divide the amount by the denominator to find what one part is worth.",
            "Then multiply that answer by the numerator to find out how many parts we need.",
            "Finding a unit fraction (like 1/5) of an amount only needs the dividing step.",
            "Finding a non-unit fraction (like 3/5) needs both steps: divide, then multiply.",
          ],
          keywords: [
            { keyword: "unit fraction", description: "A fraction with a numerator of 1, e.g. 1/4 or 1/9." },
            { keyword: "non-unit fraction", description: "A fraction with a numerator greater than 1, e.g. 3/4 or 5/9." },
            { keyword: "divide", description: "To share an amount equally into a number of parts." },
          ],
          misconceptions: [
            { misconception: "Pupils multiply the amount by the numerator first without dividing by the denominator, e.g. finding 3/4 of 20 by working out 20 x 3.", response: "Remind pupils that dividing by the denominator comes first because it tells us the size of one part; only after that do we multiply by the numerator to find several parts." },
            { misconception: "Pupils divide by the numerator instead of the denominator, e.g. finding 3/5 of 15 by dividing 15 by 3.", response: "Point back to what the denominator means — it's the number of equal groups we're splitting the amount into — so that is always the number we divide by first." },
          ],
          teacherTips: [
            "Model with a bar split into the denominator's number of equal sections, labelling one section's value, before shading the numerator's worth of sections.",
            "Choose amounts that divide exactly by the denominator at first, so pupils can focus on the method before meeting remainders.",
          ],
          transcript:
            "Hello! Today's lesson is about finding a fraction of an amount, like finding 3/4 of 20 sweets.\n\nLet's start with something simpler. Imagine you have 15 sweets and you want to find 1/5 of them. The denominator, 5, tells us to share the sweets into 5 equal groups. 15 shared into 5 equal groups is 3 sweets in each group, because 15 divided by 5 equals 3. So 1/5 of 15 is 3.\n\nNow let's try a trickier one: 3/5 of 15. We still start the same way, divide by the denominator. 15 divided by 5 is 3, so each fifth is worth 3 sweets. But this time we want 3/5, not just 1/5, so we multiply that answer by the numerator: 3 sweets multiplied by 3 gives us 9. So 3/5 of 15 is 9.\n\nThe method has two steps. Step one: divide the amount by the denominator, to find the value of one part. Step two: multiply that answer by the numerator, to find the value of however many parts we need. If we're finding a unit fraction, like 1/5, we only need step one, because we're only looking for one part.\n\nLet's try another example together: what is 2/3 of 18? First, divide 18 by the denominator, 3. That gives 6, so each third is worth 6. Then multiply by the numerator, 2, because we want two thirds: 6 times 2 is 12. So 2/3 of 18 is 12.\n\nHere's a mistake to avoid. Some people multiply by the numerator first, without dividing by the denominator, which gives a much bigger, wrong answer. Others divide by the numerator instead of the denominator. Always remember: divide by the bottom number first, then multiply by the top number.\n\nNow you'll practise finding fractions of amounts using this two-step method.",
          starterQuiz: [
            { kind: "mc", question: "What is 20 divided by 5?", correct: ["4"], distractors: ["5", "15", "100"] },
            { kind: "mc", question: "In the fraction 2/5, what does the denominator tell us?", correct: ["The whole is split into 5 equal parts"], distractors: ["We are counting 5 parts", "The fraction equals 5", "There are 5 wholes"] },
            { kind: "short", question: "What is 1/3 of 12?", answers: ["4"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is 1/4 of 20?", correct: ["5"], distractors: ["4", "16", "80"] },
            { kind: "mc", question: "To find 3/5 of an amount, what should you do first?", correct: ["Divide the amount by 5"], distractors: ["Multiply the amount by 3", "Divide the amount by 3", "Multiply the amount by 5"] },
            { kind: "short", question: "What is 2/3 of 21?", answers: ["14"] },
            { kind: "match", question: "Match each calculation to its answer.", pairs: [["1/4 of 24", "6"], ["3/4 of 24", "18"], ["1/6 of 24", "4"]] },
            { kind: "order", question: "Order the steps for finding 3/4 of 20: divide 20 by the denominator, 4; find that one quarter is 5; multiply 5 by the numerator, 3; the answer is 15.", items: ["divide 20 by the denominator, 4", "find that one quarter is 5", "multiply 5 by the numerator, 3", "the answer is 15"] },
          ],
          worksheet: [
            { text: "Find 1/3 of 27.", type: "numeric", answer: "9" },
            { text: "Find 3/8 of 16.", type: "numeric", answer: "6" },
            { text: "Find 2/5 of 30.", type: "numeric", answer: "12" },
            { text: "A class of 28 pupils has 3/4 of them bringing a packed lunch. Explain how you would work out how many pupils that is, then give the answer.", type: "extended", answer: "A good answer divides 28 by the denominator 4 to get 7, then multiplies 7 by the numerator 3, giving 21 pupils." },
          ],
        },
      ],
    },
    {
      slug: "decimals-and-percentages",
      title: "Decimals and percentages",
      description:
        "Pupils extend their understanding of decimal place value to three decimal places, connect decimals with their equivalent fractions, and calculate simple percentages of amounts.",
      whyThisWhyNow:
        "Having secured fraction skills in the previous unit, pupils now see how decimals and percentages are simply other ways of representing the same fraction relationships, ready for more complex calculations in Year 6.",
      priorKnowledge: [
        "Pupils can read and write decimal numbers with up to two decimal places, e.g. 3.45.",
        "Pupils understand tenths and hundredths as fractions and as decimals.",
        "Pupils can order a set of decimal numbers.",
      ],
      nationalCurriculum: [
        "Read, write, order and compare numbers with up to three decimal places.",
        "Recognise the per cent symbol (%) and understand that per cent relates to 'number of parts per hundred'.",
        "Solve problems which require knowing percentage and decimal equivalents.",
      ],
      lessons: [
        {
          slug: "decimal-place-value-to-three-decimal-places",
          title: "Decimal place value to three decimal places",
          pupilLessonOutcome: "I can read, write and understand the value of digits in numbers with up to three decimal places.",
          keyLearningPoints: [
            "The first digit after the decimal point is the tenths column, the second is the hundredths column, and the third is the thousandths column.",
            "Each column to the right of the decimal point is ten times smaller than the one before it.",
            "A digit's value depends on which column it is in, e.g. the 4 in 0.243 is worth 4 hundredths, not 4 tenths.",
            "Zero can be used as a placeholder, e.g. in 0.05, the zero shows there are no tenths.",
          ],
          keywords: [
            { keyword: "tenths", description: "The first column after the decimal point; each tenth is one part when a whole is split into 10 equal parts." },
            { keyword: "hundredths", description: "The second column after the decimal point; each hundredth is one part when a whole is split into 100 equal parts." },
            { keyword: "thousandths", description: "The third column after the decimal point; each thousandth is one part when a whole is split into 1000 equal parts." },
          ],
          misconceptions: [
            { misconception: "Pupils think that more digits after the decimal point always means a bigger number, e.g. thinking 0.4 is smaller than 0.25 because 0.4 has fewer digits.", response: "Line the numbers up by place value using a place value grid, adding a trailing zero to 0.4 to make 0.40, so pupils can see 0.40 is bigger than 0.25 because 4 tenths is more than 2 tenths." },
            { misconception: "Pupils read 0.05 as 'zero point five' instead of 'zero point zero five', missing the placeholder zero.", response: "Point to the empty tenths column and explain the zero must be said and written to hold that column's place, otherwise the digit 5 would jump into the wrong column." },
          ],
          teacherTips: [
            "Use a place value grid with headed columns (tenths, hundredths, thousandths) so pupils can physically place digits in the correct column.",
            "Link each column back to fractions pupils already know: tenths to /10, hundredths to /100, to reinforce that decimals and fractions describe the same thing.",
          ],
          transcript:
            "Hello! Today we're looking closely at decimal numbers, and working out exactly what each digit after the decimal point is worth.\n\nYou already know that in a whole number like 352, the 3 is worth three hundred, the 5 is worth fifty, and the 2 is worth two, because of which column each digit sits in. Decimals work in exactly the same way, but the columns get smaller as we move right, past the decimal point.\n\nThe first column after the decimal point is called the tenths column. In the number 0.7, the 7 is in the tenths column, so it's worth seven tenths. The next column is the hundredths column, ten times smaller again. In the number 0.47, the 4 is worth four tenths, and the 7 is worth seven hundredths. The third column is the thousandths column, another ten times smaller. In the number 0.256, the 2 is two tenths, the 5 is five hundredths, and the 6 is six thousandths.\n\nEach column is exactly ten times smaller than the column to its left, just like whole numbers, only now we're moving in the other direction, getting smaller each time.\n\nSometimes a column has nothing in it, and we use a zero to hold that place. Take the number 0.08. There's a zero in the tenths column, which tells us there are no tenths at all, and the 8 is in the hundredths column, worth eight hundredths. If we left that zero out and just wrote 0.8, the 8 would jump into the tenths column, and become a much bigger number, eight tenths instead of eight hundredths.\n\nHere's a common mistake. Some people think a decimal with more digits must be bigger, so they think 0.4 is smaller than 0.25 because 0.4 only has one digit. But 0.4 is the same as 0.40, which is four tenths, and that's bigger than 0.25, which is two tenths and five hundredths. Always compare column by column, starting with the tenths.\n\nNow let's practise reading and writing decimal numbers together.",
          starterQuiz: [
            { kind: "mc", question: "In the number 3.45, what is the value of the 4?", correct: ["Four tenths"], distractors: ["Four hundredths", "Forty", "Four"] },
            { kind: "mc", question: "Which is bigger, 0.6 or 0.45?", correct: ["0.6"], distractors: ["0.45", "They are equal", "Cannot tell"] },
            { kind: "short", question: "Write four tenths as a decimal.", answers: ["0.4"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "In the number 0.372, what is the value of the 7?", correct: ["Seven hundredths"], distractors: ["Seven tenths", "Seven thousandths", "Seventy"] },
            { kind: "mc", question: "What is the purpose of the zero in 0.05?", correct: ["It shows there are no tenths"], distractors: ["It shows there are no hundredths", "It makes the number bigger", "It has no purpose"] },
            { kind: "short", question: "Write 'three tenths, two hundredths and five thousandths' as a decimal.", answers: ["0.325"] },
            { kind: "match", question: "Match each decimal to the value of its first digit after the point.", pairs: [["0.6", "six tenths"], ["0.3", "three tenths"], ["0.9", "nine tenths"]] },
            { kind: "order", question: "Order these decimals from smallest to largest: 0.45, 0.5, 0.09.", items: ["0.09", "0.45", "0.5"] },
          ],
          worksheet: [
            { text: "What is the value of the 6 in 0.263?", type: "short", answer: "six thousandths" },
            { text: "Write the decimal that has 5 in the tenths column, 0 in the hundredths column and 2 in the thousandths column.", type: "short", answer: "0.502" },
            { text: "Order these decimals from largest to smallest: 0.7, 0.68, 0.702.", type: "short", answer: "0.702, 0.7, 0.68" },
            { text: "Explain why 0.5 and 0.50 have exactly the same value.", type: "extended", answer: "A good answer explains that the extra zero is in the hundredths column but adds nothing there, so 0.50 still means five tenths and no hundredths, the same value as 0.5; trailing zeros after the decimal point don't change a number's value." },
          ],
        },
        {
          slug: "converting-between-fractions-and-decimals",
          title: "Converting between fractions and decimals",
          pupilLessonOutcome: "I can convert between fractions with a denominator of 10 or 100 and their decimal equivalents.",
          keyLearningPoints: [
            "A fraction with a denominator of 10 converts directly to a decimal with one digit after the decimal point, e.g. 3/10 = 0.3.",
            "A fraction with a denominator of 100 converts directly to a decimal with two digits after the decimal point, e.g. 47/100 = 0.47.",
            "Some common fractions have decimal equivalents worth memorising, such as 1/2 = 0.5, 1/4 = 0.25, and 3/4 = 0.75.",
            "To convert a fraction with a different denominator, first find an equivalent fraction with a denominator of 10 or 100.",
          ],
          keywords: [
            { keyword: "equivalent", description: "Having the same value, even though written differently, e.g. 1/2 and 0.5 are equivalent." },
            { keyword: "decimal equivalent", description: "The decimal number that has exactly the same value as a given fraction." },
            { keyword: "convert", description: "To change a number from one form into another without changing its value." },
          ],
          misconceptions: [
            { misconception: "Pupils convert 3/10 to 0.3 correctly, but then convert 3/100 to 0.3 as well, forgetting the extra place value column.", response: "Show that hundredths need two digits after the point, so 3/100 must be written 0.03, with a placeholder zero in the tenths column, not 0.3." },
            { misconception: "Pupils think 1/4 converts to 0.14 by just using the digits in the fraction.", response: "Show the working: 1/4 is equivalent to 25/100 (multiplying top and bottom by 25), and 25/100 is 0.25 — the conversion goes through finding an equivalent hundredths fraction, not just copying digits." },
          ],
          teacherTips: [
            "Keep a hundred square visible so pupils can shade a fraction of it and read off the decimal directly, e.g. shading 47 squares out of 100 shows 47/100 = 0.47.",
            "Build a short list of 'facts to know by heart' (1/2, 1/4, 3/4, 1/5, 1/10) and practise them regularly until they are instant recall.",
          ],
          transcript:
            "Hello! Today we're linking two things you already know about, fractions and decimals, by converting between them.\n\nLet's start with tenths. If I have the fraction 3/10, that means 3 parts out of 10. In decimal form, tenths sit in the very first column after the decimal point. So 3/10 is exactly the same as the decimal 0.3. They're two different ways of writing the same value.\n\nHundredths work the same way, but they use the second column after the decimal point. The fraction 47/100 means 47 parts out of 100, and as a decimal, that's 0.47, the 4 sits in the tenths column and the 7 sits in the hundredths column.\n\nNow, what if the fraction has a different denominator, like 1/4? We can't write quarters straight into a place value column, so first we find an equivalent fraction with a denominator of 10 or 100. To turn 1/4 into hundredths, we multiply the numerator and denominator by 25, because 4 times 25 is 100. That gives us 25/100, which as a decimal is 0.25. So 1/4 = 0.25.\n\nSome fraction and decimal pairs come up so often that it's worth learning them by heart: 1/2 is 0.5, 1/4 is 0.25, 3/4 is 0.75, and 1/10 is 0.1. Knowing these instantly will save you time later.\n\nNow, a common mistake. If someone is converting 3/100 to a decimal, they might carelessly write 0.3, copying the digits without thinking about place value. But 3/100 only has three hundredths, not three tenths, so it needs a placeholder zero in the tenths column: the correct answer is 0.03. Always check how many digits the denominator needs, tenths need one decimal place, hundredths need two.\n\nLet's practise converting between fractions and decimals now.",
          starterQuiz: [
            { kind: "mc", question: "What is the value of the 6 in 0.163?", correct: ["Six hundredths"], distractors: ["Six tenths", "Six thousandths", "Sixty"] },
            { kind: "mc", question: "Which fraction is equivalent to 1/2 when the top and bottom are multiplied by 50?", correct: ["50/100"], distractors: ["1/50", "50/2", "2/100"] },
            { kind: "short", question: "Write 7 tenths as a decimal.", answers: ["0.7"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is 3/10 as a decimal?", correct: ["0.3"], distractors: ["0.03", "0.13", "3.10"] },
            { kind: "mc", question: "What is 1/4 as a decimal?", correct: ["0.25"], distractors: ["0.14", "0.4", "1.4"] },
            { kind: "short", question: "Write 65/100 as a decimal.", answers: ["0.65"] },
            { kind: "match", question: "Match each fraction to its decimal equivalent.", pairs: [["1/2", "0.5"], ["3/4", "0.75"], ["9/10", "0.9"]] },
            { kind: "order", question: "Order these from smallest to largest: 0.4, 1/2, 0.25.", items: ["0.25", "0.4", "1/2"] },
          ],
          worksheet: [
            { text: "Write 9/10 as a decimal.", type: "short", answer: "0.9" },
            { text: "Write 3/4 as a decimal.", type: "short", answer: "0.75" },
            { text: "Write 8/100 as a decimal.", type: "short", answer: "0.08" },
            { text: "Explain how you would convert 1/5 into a decimal, showing your working.", type: "extended", answer: "A good answer finds an equivalent fraction with a denominator of 10 by multiplying top and bottom by 2, giving 2/10, and then writes this as the decimal 0.2." },
          ],
        },
        {
          slug: "finding-percentages-of-amounts",
          title: "Finding percentages of amounts",
          pupilLessonOutcome: "I can find simple percentages (10%, 25%, 50%) of an amount.",
          keyLearningPoints: [
            "Per cent means 'out of 100', and the symbol % is used to show it.",
            "10% of an amount is found by dividing the amount by 10.",
            "50% of an amount is the same as finding one half; 25% is the same as finding one quarter.",
            "Once we know 10% of an amount, we can use it to find other percentages, e.g. 20% is double 10%.",
          ],
          keywords: [
            { keyword: "per cent", description: "Meaning 'out of 100'; shown using the % symbol, e.g. 25% means 25 out of 100." },
            { keyword: "percentage", description: "A way of describing part of a whole as a number out of 100." },
            { keyword: "equivalent", description: "Having the same value even though shown in a different way, e.g. 50% is equivalent to 1/2." },
          ],
          misconceptions: [
            { misconception: "Pupils think finding 10% means dividing by 100 rather than by 10, muddling percentage with the fact that percentages are measured out of 100.", response: "Remind pupils that finding 10% specifically means finding one tenth, so we divide by 10; percentages are always measured out of 100, but that doesn't mean we always divide by 100." },
            { misconception: "Pupils think 50% and 25% need a completely different method from fractions, rather than connecting them to halves and quarters they already know.", response: "Explicitly link each percentage to its matching fraction, e.g. show 50% of 40 the fraction way (half of 40) and the percentage way (50 out of every 100), so pupils see they give the same answer." },
          ],
          teacherTips: [
            "Anchor everything to 10% first, since it is the easiest percentage to calculate and can be scaled up or down to find many others (20%, 30%, 5%).",
            "Use money as a context (e.g. a shop sale) since percentages of amounts are a familiar real-life idea for this age group.",
          ],
          transcript:
            "Hello! Today we're finding percentages of amounts, something you'll see in real life, like sale signs in shops that say '25% off'.\n\nThe word per cent means 'out of 100'. We write it using the % symbol. So 50% means 50 out of 100, and 25% means 25 out of 100.\n\nLet's start with the easiest percentage to find: 10%. Because 10% means 10 out of every 100, finding 10% of an amount is the same as dividing that amount by 10. So 10% of 60 is 60 divided by 10, which is 6.\n\nOnce we know 10% of something, we can use it to find lots of other percentages. For example, 20% is double 10%, so 20% of 60 would be 6 doubled, which is 12. And 5% is half of 10%, so 5% of 60 would be half of 6, which is 3.\n\nNow let's think about 50% and 25%. These connect to fractions you already know well. 50% is exactly the same as one half, because 50 out of 100 is the same amount as 1 out of 2. So finding 50% of an amount is the same as halving it. 50% of 30 is 15.\n\n25% is the same as one quarter, because 25 out of 100 is the same as 1 out of 4. So finding 25% of an amount is the same as finding a quarter of it, which means dividing by 4. 25% of 40 is 10.\n\nA common mistake is muddling up what 'divide by 10' really means for 10%. Some people think percentages always mean dividing by 100, but dividing the whole amount by 100 actually gives us 1%, not 10%. To find 10% specifically, we divide by 10, because 10% is one tenth of the whole.\n\nNow you'll practise finding 10%, 50% and 25% of different amounts.",
          starterQuiz: [
            { kind: "mc", question: "What is 1/2 of 40?", correct: ["20"], distractors: ["10", "40", "4"] },
            { kind: "mc", question: "What is 1/4 of 40?", correct: ["10"], distractors: ["20", "4", "5"] },
            { kind: "short", question: "What is 60 divided by 10?", answers: ["6"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What does 'per cent' mean?", correct: ["Out of 100"], distractors: ["Out of 10", "Out of 1000", "A type of fraction with a denominator of 4"] },
            { kind: "mc", question: "What is 10% of 80?", correct: ["8"], distractors: ["80", "0.8", "18"] },
            { kind: "short", question: "What is 50% of 36?", answers: ["18"] },
            { kind: "match", question: "Match each percentage to the fraction it is equivalent to.", pairs: [["50%", "1/2"], ["25%", "1/4"], ["10%", "1/10"]] },
            { kind: "order", question: "Order the steps for finding 25% of 40: recognise 25% is the same as one quarter, divide 40 by 4, the answer is 10.", items: ["recognise 25% is the same as one quarter", "divide 40 by 4", "the answer is 10"] },
          ],
          worksheet: [
            { text: "Find 10% of 90.", type: "numeric", answer: "9" },
            { text: "Find 50% of 64.", type: "numeric", answer: "32" },
            { text: "Find 25% of 200.", type: "numeric", answer: "50" },
            { text: "A jacket costs £40 and is reduced by 25% in a sale. Explain how you would work out the new price, and give your answer.", type: "extended", answer: "A good answer recognises 25% is one quarter, finds a quarter of £40 (£10), and subtracts it from £40 to get a new price of £30." },
          ],
        },
      ],
    },
  ],
};
