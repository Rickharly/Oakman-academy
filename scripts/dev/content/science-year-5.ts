import type { SubjectYearSpec } from "./types";

export const scienceYear5: SubjectYearSpec = {
  subject: { slug: "science", title: "Science" },
  programme: {
    sequenceSlug: "science-primary",
    yearGroup: 5,
    keyStage: "ks2",
    phase: "primary",
    title: "Science — Year 5",
  },
  units: [
    {
      slug: "properties-and-changes-of-materials",
      title: "Properties and changes of materials",
      description:
        "Pupils investigate the properties of solids, liquids and gases, explore dissolving and separating mixtures, and distinguish between reversible and irreversible changes.",
      whyThisWhyNow:
        "This unit builds on pupils' Year 4 work identifying and grouping materials, moving them towards a more scientific understanding of how and why materials change, ready for chemistry concepts in secondary school.",
      priorKnowledge: [
        "Pupils can compare and group materials based on their properties, e.g. hard/soft, rough/smooth.",
        "Pupils know that materials can be solid, liquid or gas.",
        "Pupils have observed that some materials change when heated or cooled, e.g. ice melting.",
      ],
      nationalCurriculum: [
        "Compare and group together everyday materials on the basis of their properties, including hardness and solubility.",
        "Know that some materials will dissolve in liquid to form a solution, and describe how to recover a substance from a solution.",
        "Use knowledge of solids, liquids and gases to decide how mixtures might be separated, including through filtering, sieving and evaporating.",
        "Demonstrate that dissolving, mixing and changes of state are reversible changes, and explain that some changes result in the formation of new materials that are not usually reversible.",
      ],
      lessons: [
        {
          slug: "properties-of-materials-solids-liquids-gases",
          title: "Solids, liquids and gases",
          pupilLessonOutcome: "I can describe and compare the properties of solids, liquids and gases.",
          keyLearningPoints: [
            "A solid keeps its own shape and volume, whatever container it is put in.",
            "A liquid keeps the same volume but changes shape to fill the bottom of whatever container it is put in.",
            "A gas has no fixed shape or volume; it spreads out to fill the whole of whatever container it is put in.",
            "The same substance, such as water, can exist as a solid, liquid or gas depending on its temperature.",
          ],
          keywords: [
            { keyword: "solid", description: "A material that keeps its own fixed shape and volume." },
            { keyword: "liquid", description: "A material that flows and takes the shape of its container, but keeps the same volume." },
            { keyword: "gas", description: "A material with no fixed shape or volume that spreads out to completely fill its container." },
          ],
          misconceptions: [
            { misconception: "Pupils think that if a solid is broken into small pieces, like sand or sugar, it becomes a liquid because it can be poured.", response: "Explain that each individual grain of sand or sugar is still a solid, keeping its own shape; it's only the whole collection of separate grains that can be poured, unlike a true liquid which flows as one connected substance." },
            { misconception: "Pupils think gases don't really exist, or don't have mass, unless they can be seen, such as smoke or steam.", response: "Point out that air, an invisible gas, still takes up space and has mass, e.g. a football feels heavier and firmer when pumped full of air compared with when it is flat." },
          ],
          teacherTips: [
            "Use real, safe examples pupils can handle or observe (an ice cube, water, steam from a kettle seen from a safe distance) to link the states directly to a single familiar substance, water.",
            "Ask pupils to test their idea that 'sand is a liquid because it pours' by examining a single grain of sand closely, to correct the misconception directly.",
          ],
          transcript:
            "Hello! Today we're looking at the three states that materials can exist in: solid, liquid and gas.\n\nLet's start with a solid. A solid keeps its own shape, no matter what container you put it in. If you put a wooden block in a bowl, it stays a block shape. If you put it in a jug instead, it's still exactly the same shape. Solids also keep the same volume, meaning the same amount of space, wherever they go.\n\nNow let's think about a liquid, like water. If you pour water into a bowl, it spreads out and takes the shape of the bottom of the bowl. Pour the same water into a tall, thin glass instead, and it changes shape again. But the amount of water, its volume, stays exactly the same. A liquid changes shape to match its container, but keeps the same volume.\n\nFinally, there's gas. Gas has no fixed shape and no fixed volume at all. If you release a gas into a room, it doesn't sit in a puddle like a liquid would, it spreads out and fills the entire room, however big that room is.\n\nHere's something fascinating: the very same substance can exist in all three states, depending on how hot or cold it is. Take water. As ice, it's a solid, with a fixed shape. Warm it up, and it melts into liquid water, which flows and takes the shape of its container. Heat it further, and it turns into steam, a gas, which spreads out and disappears into the air.\n\nA common mistake is thinking that sand or sugar is a liquid because it can be poured. But look closely: each tiny grain of sand keeps its own solid shape. It's only the whole collection of separate grains, pouring past each other, that looks a bit like a liquid. It's still made of millions of tiny solids.\n\nNow you'll investigate and sort some materials into solids, liquids and gases.",
          starterQuiz: [
            { kind: "mc", question: "Which of these is an example of a liquid?", correct: ["milk"], distractors: ["a brick", "air", "a wooden spoon"] },
            { kind: "mc", question: "What happens to ice when it is heated?", correct: ["It melts into liquid water"], distractors: ["It turns into a gas immediately", "It stays solid", "It disappears completely"] },
            { kind: "short", question: "Name one material that is a solid at room temperature.", answers: ["wood", "metal", "stone", "plastic", "glass", "rock"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "Which property is true of a solid?", correct: ["It keeps its own fixed shape"], distractors: ["It takes the shape of its container", "It has no fixed shape or volume", "It always flows"] },
            { kind: "mc", question: "Which property is true of a gas?", correct: ["It has no fixed shape or volume"], distractors: ["It keeps a fixed shape", "It only flows downward", "It cannot be poured"] },
            { kind: "short", question: "What happens to liquid water when it is heated enough?", answers: ["it turns into gas", "it becomes steam", "it evaporates into a gas"] },
            { kind: "match", question: "Match each state of matter to its correct description.", pairs: [["solid", "keeps a fixed shape and volume"], ["liquid", "takes the shape of its container but keeps the same volume"], ["gas", "spreads out to fill the whole container"]] },
            { kind: "order", question: "Order these states of water from coldest to hottest: liquid water, ice, steam.", items: ["ice", "liquid water", "steam"] },
          ],
          worksheet: [
            { text: "Name the three states of matter.", type: "short", answer: "solid, liquid, gas" },
            { text: "Explain why sand can be poured even though each grain is a solid.", type: "extended", answer: "A good answer explains that each individual grain of sand keeps its own solid shape, but the huge number of separate grains can slide past one another and be poured, unlike a true liquid which flows as one connected substance." },
            { text: "Describe what happens to the volume of a liquid when it is poured into a different-shaped container.", type: "short", answer: "the volume stays the same, only the shape changes" },
            { text: "Explain why a gas released into a room fills the whole room, using the word 'volume' in your answer.", type: "extended", answer: "A good answer explains that a gas has no fixed volume or shape, so it spreads out and expands until it fills the whole available space in the room, unlike a solid or liquid which keep a fixed volume." },
          ],
        },
        {
          slug: "dissolving-and-separating-mixtures",
          title: "Dissolving and separating mixtures",
          pupilLessonOutcome: "I can explain what happens when a substance dissolves, and describe ways to separate different types of mixtures.",
          keyLearningPoints: [
            "When a soluble solid dissolves in a liquid, it seems to disappear, but it is still there, broken into particles too small to see, forming a solution.",
            "A solution is a mixture formed when a solid dissolves completely in a liquid.",
            "Not all solids dissolve; those that do not dissolve are called insoluble.",
            "Different separating methods suit different mixtures: filtering separates an insoluble solid from a liquid, sieving separates solids of different sizes, and evaporating recovers a dissolved solid from a solution.",
          ],
          keywords: [
            { keyword: "dissolve", description: "When a solid mixes completely into a liquid, breaking into particles too small to see, forming a solution." },
            { keyword: "solution", description: "A mixture formed when a solid dissolves completely in a liquid." },
            { keyword: "insoluble", description: "Describes a solid that does not dissolve in a particular liquid." },
          ],
          misconceptions: [
            { misconception: "Pupils think a dissolved solid has disappeared completely or has been destroyed.", response: "Point out that evaporating the liquid brings the solid back exactly as it was — it has not disappeared, just spread out too small to see." },
            { misconception: "Pupils think 'dissolving' and 'melting' are the same thing.", response: "Contrast the two clearly: melting is a solid turning into a liquid because of heat (like ice into water), with no other substance needed, whereas dissolving needs a solid to mix into a separate liquid to form a solution." },
          ],
          teacherTips: [
            "Let pupils observe salt or sugar dissolving in water, then evaporate a small sample to reveal the solid again, providing direct evidence it hasn't disappeared.",
            "Use a sorting table (soluble/insoluble, and which separating method fits which mixture) to help pupils link each mixture type to the correct method.",
          ],
          transcript:
            "Hello! Today we're exploring what happens when things dissolve, and how we can separate different types of mixtures.\n\nHave you ever stirred sugar into a cup of tea and watched it seem to vanish? That's dissolving. When a solid like sugar dissolves in a liquid like water, it breaks up into particles far too small for us to see. The sugar hasn't disappeared or been destroyed, it's still there, spread evenly through the water. This mixture of a dissolved solid and a liquid is called a solution.\n\nNot every solid dissolves. If you stir sand into water, it doesn't disappear, it just sits there or swirls around, still visible as sand. We say sand is insoluble in water, meaning it will not dissolve in it.\n\nHow do we know the sugar is still there? If we let the water evaporate, turning from a liquid into a gas that drifts into the air, the sugar is left behind, exactly as before. This proves the sugar didn't vanish, it was just spread too small to see.\n\nNow, different mixtures need different separating methods. If you have an insoluble solid mixed into a liquid, like sand in water, you use filtering: pouring the mixture through filter paper with tiny holes, small enough to let the water through but too small for the sand, trapping the sand behind.\n\nIf you have a mixture of two solids with different sized pieces, like pebbles and sand, you use sieving: a sieve has holes of a certain size, letting the smaller sand fall through while trapping the larger pebbles.\n\nAnd if you want to recover a solid that has dissolved, like getting the salt back out of salty water, you use evaporation: heating the solution gently so the liquid turns to gas and drifts away, leaving the solid behind.\n\nThe common mistake is muddling dissolving with melting. Melting is a solid turning into a liquid because of heat, like ice turning to water. Dissolving needs two different substances, a solid mixing into a separate liquid.\n\nNow you'll investigate dissolving and try separating a mixture yourself.",
          starterQuiz: [
            { kind: "mc", question: "What is the name for a material that keeps its own fixed shape?", correct: ["a solid"], distractors: ["a liquid", "a gas", "a solution"] },
            { kind: "mc", question: "Which state of matter has no fixed shape or volume?", correct: ["gas"], distractors: ["solid", "liquid", "none of these"] },
            { kind: "short", question: "Name one material that dissolves in water.", answers: ["salt", "sugar"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is a solution?", correct: ["A mixture formed when a solid dissolves completely in a liquid"], distractors: ["Any mixture of two solids", "A solid that has melted", "A liquid that has evaporated"] },
            { kind: "mc", question: "Which method would best separate sand from water?", correct: ["Filtering"], distractors: ["Evaporating", "Sieving", "Stirring"] },
            { kind: "short", question: "What word describes a solid that will not dissolve in a liquid?", answers: ["insoluble"] },
            { kind: "match", question: "Match each separating method to the mixture it is best suited to.", pairs: [["Filtering", "an insoluble solid mixed with a liquid"], ["Sieving", "two solids with different sized pieces"], ["Evaporating", "a solid dissolved in a liquid"]] },
            { kind: "order", question: "Order these steps for recovering salt from salty water.", items: ["pour the solution into a shallow dish", "gently heat the solution", "the water evaporates into the air", "the salt is left behind"] },
          ],
          worksheet: [
            { text: "What is the name of a mixture formed when a solid dissolves completely in a liquid?", type: "short", answer: "a solution" },
            { text: "Explain how you know that sugar has not disappeared when it dissolves in water.", type: "extended", answer: "A good answer explains that if the water is evaporated, the sugar is left behind exactly as before, showing it was still there all along, just broken into particles too small to see." },
            { text: "Would you use filtering or sieving to separate pebbles from sand? Explain your answer.", type: "extended", answer: "A good answer chooses sieving, and explains that both pebbles and sand are solids of different sizes, so a sieve with holes of the right size lets the smaller sand fall through while trapping the larger pebbles." },
            { text: "Explain the difference between dissolving and melting.", type: "extended", answer: "A good answer explains that melting is a solid turning into a liquid because of heat with no other substance involved (like ice into water), while dissolving is a solid mixing completely into a separate liquid to form a solution." },
          ],
        },
        {
          slug: "reversible-and-irreversible-changes",
          title: "Reversible and irreversible changes",
          pupilLessonOutcome: "I can distinguish between reversible and irreversible changes and explain why.",
          keyLearningPoints: [
            "A reversible change can be undone, and the original materials can be recovered, e.g. melting, freezing, dissolving and mixing.",
            "An irreversible change cannot be undone; the original materials cannot be recovered because a new material has been formed.",
            "A key sign of an irreversible change is when heating or mixing produces a completely new substance with different properties, such as burning wood into ash, or baking a cake.",
            "The test for reversibility is simple: can the original materials be recovered? If yes, it's reversible; if a new material has formed and cannot be undone, it's irreversible.",
          ],
          keywords: [
            { keyword: "reversible change", description: "A change that can be undone, allowing the original materials to be recovered." },
            { keyword: "irreversible change", description: "A change that cannot be undone, because a new material has formed." },
            { keyword: "new material", description: "A substance with different properties from the materials that combined or changed to form it." },
          ],
          misconceptions: [
            { misconception: "Pupils think all changes caused by heating are irreversible, because they associate heat with cooking or burning.", response: "Contrast melting chocolate (reversible, it can be cooled back to a solid) with baking a cake (irreversible, the raw ingredients cannot be recovered once baked) to show that heating alone doesn't decide reversibility; what matters is whether a new material has formed." },
            { misconception: "Pupils think mixing two substances together always creates an irreversible change, because the substances 'disappear' into each other.", response: "Show an example like mixing sand and water, which can be separated again by filtering, to demonstrate that mixing alone does not always create a new material." },
          ],
          teacherTips: [
            "Build a class table of examples pupils suggest, sorting them into reversible and irreversible, and discuss any that cause debate to sharpen the 'can we get the original material back?' test.",
            "Use dramatic, memorable examples (toasting bread, burning a candle, baking a cake) to anchor the idea of irreversible change, since new materials with new properties are formed.",
          ],
          transcript:
            "Hello! Today we're comparing reversible and irreversible changes, and working out how to tell them apart.\n\nA reversible change is one that can be undone. Think about melting ice. If you melt an ice cube, it turns into liquid water. But if you put that water back in the freezer, it turns back into ice. We've undone the change completely, so melting and freezing are reversible changes. Dissolving is reversible too: if you dissolve salt in water, you can evaporate the water and get the salt back again.\n\nAn irreversible change is different. It cannot be undone, because the original materials have been changed into something new, and we cannot get them back. Think about baking a cake. You mix flour, eggs and sugar, and once you bake that mixture, you cannot un-bake it back into flour, eggs and sugar again. A completely new material, cake, has been formed, with totally different properties from the ingredients that made it.\n\nBurning is another really clear example. If you burn a piece of wood, it turns into ash and smoke. You can never turn that ash back into wood. A new material has been created, and there's no way back.\n\nSo how do we tell reversible and irreversible changes apart? Ask yourself: can I get the original materials back? If yes, it's reversible. If no, because a new material has formed, it's irreversible.\n\nHere's a mistake to watch out for. Some people think that any change caused by heating must be irreversible, because they think of cooking and burning. But melting chocolate with gentle heat is reversible, you can let it cool and it turns solid again. It's only when heating creates a genuinely new substance, like turning cake batter into cake, that the change becomes irreversible.\n\nAnother mistake is thinking that mixing two things together always makes an irreversible change. But mixing sand into water doesn't create a new material, we can still filter the sand back out, so that's reversible.\n\nNow you'll sort some everyday changes into reversible and irreversible, explaining your reasoning.",
          starterQuiz: [
            { kind: "mc", question: "What is a solution?", correct: ["A mixture formed when a solid dissolves in a liquid"], distractors: ["A solid that has melted", "A mixture of two gases", "A new material formed by burning"] },
            { kind: "mc", question: "Which method would recover salt from salty water?", correct: ["Evaporating"], distractors: ["Filtering", "Sieving", "Freezing"] },
            { kind: "short", question: "What happens to ice when it melts?", answers: ["it turns into liquid water", "it becomes water"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is a reversible change?", correct: ["A change that can be undone, recovering the original materials"], distractors: ["A change that always involves heating", "A change that creates a new material", "A change that cannot be undone"] },
            { kind: "mc", question: "Which of these is an irreversible change?", correct: ["Burning a piece of wood"], distractors: ["Melting an ice cube", "Dissolving sugar in water", "Freezing water"] },
            { kind: "short", question: "What forms when an irreversible change happens?", answers: ["a new material", "a new substance"] },
            { kind: "match", question: "Match each change to whether it is reversible or irreversible.", pairs: [["Melting chocolate", "reversible"], ["Baking a cake", "irreversible"], ["Dissolving salt in water", "reversible"]] },
            { kind: "order", question: "Order these steps for testing whether a change is reversible.", items: ["make the change happen", "try to get the original materials back", "check if a new material has formed", "decide if it is reversible or irreversible"] },
          ],
          worksheet: [
            { text: "Name two changes of state that are reversible opposites of each other.", type: "short", answer: "melting and freezing" },
            { text: "Explain why baking a cake is an irreversible change.", type: "extended", answer: "A good answer explains that baking combines the ingredients (flour, eggs, sugar) into a completely new material, cake, with different properties, and there is no way to separate the ingredients back out again." },
            { text: "Is dissolving sugar in water reversible or irreversible? Explain how you know.", type: "extended", answer: "A good answer says it is reversible, and explains that evaporating the water leaves the sugar behind unchanged, showing the original materials can be recovered." },
            { text: "Explain why melting chocolate is reversible but baking a cake is not, even though both involve heat.", type: "extended", answer: "A good answer explains that melting chocolate only changes its state (solid to liquid), and cooling it reverses this exactly, whereas baking a cake creates a genuinely new material from the ingredients that cannot be separated back out, regardless of temperature." },
          ],
        },
      ],
    },
    {
      slug: "earth-and-space",
      title: "Earth and space",
      description:
        "Pupils learn about the planets in our solar system and their orbits, understand what causes day and night, and explore the Moon and why it appears to change shape.",
      whyThisWhyNow:
        "This unit introduces pupils to their first formal model of the solar system, building spatial reasoning about the Earth's movement that underpins later physics and astronomy.",
      priorKnowledge: [
        "Pupils know that the Sun is a source of light and heat, and that the Earth is a planet.",
        "Pupils have observed that the Moon appears to change shape over time.",
        "Pupils understand that the Earth is round, like a giant ball, not flat.",
      ],
      nationalCurriculum: [
        "Describe the movement of the Earth, and other planets, relative to the Sun in the solar system.",
        "Describe the movement of the Moon relative to the Earth, and describe the Sun, Earth and Moon as approximately spherical bodies.",
        "Use the idea of the Earth's rotation to explain day and night and the apparent movement of the Sun across the sky.",
      ],
      lessons: [
        {
          slug: "the-solar-system-planets-and-orbits",
          title: "The solar system: planets and orbits",
          pupilLessonOutcome: "I can describe the order of the planets in the solar system and explain what an orbit is.",
          keyLearningPoints: [
            "The solar system is made up of the Sun and everything that travels around it, including eight planets.",
            "The order of the planets from the Sun is Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.",
            "An orbit is the curved path an object takes as it travels around another object in space, such as a planet orbiting the Sun.",
            "Planets closer to the Sun take less time to complete one orbit than planets further away.",
          ],
          keywords: [
            { keyword: "solar system", description: "The Sun and all the planets, moons and other objects that travel around it." },
            { keyword: "orbit", description: "The curved path that an object follows as it travels around another object in space." },
            { keyword: "planet", description: "A large, round object in space that orbits a star, such as the Sun." },
          ],
          misconceptions: [
            { misconception: "Pupils think the Sun orbits the Earth, based on how it looks from the ground.", response: "Explain that although the Sun appears to move across our sky, it is actually the Earth spinning and orbiting the Sun that causes this, not the Sun moving around us; use a simple model to show the Earth as one of eight planets orbiting the Sun." },
            { misconception: "Pupils think planets orbit at the same speed and are all roughly the same size and distance apart, as shown in simplified classroom diagrams.", response: "Clarify that classroom diagrams are not to scale; the actual distances and sizes between planets vary enormously and are far bigger than diagrams suggest." },
          ],
          teacherTips: [
            "Use a memorable mnemonic for planet order, e.g. 'My Very Easy Method Just Speeds Up Naming' for Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.",
            "Be explicit that classroom models and diagrams of the solar system are never drawn to scale, since real distances are too vast to fit on a page.",
          ],
          transcript:
            "Hello! Today we're exploring the solar system, the Sun and all the planets that travel around it.\n\nAt the centre of our solar system is the Sun, a huge, glowing star. Everything else in the solar system travels around the Sun, including eight planets. Earth, the planet we live on, is one of them.\n\nThe path a planet takes as it travels around the Sun is called an orbit. Imagine tying a ball to a piece of string and swinging it around your hand in a circle, that curved path is a bit like an orbit, except planets are held in their orbit by gravity, an invisible pulling force, rather than a string.\n\nThe eight planets, in order starting from the one closest to the Sun, are: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune. A handy way to remember this order is the sentence 'My Very Easy Method Just Speeds Up Naming', the first letter of each word matches the first letter of each planet.\n\nHere's something important: planets closer to the Sun take less time to complete one full orbit than planets further away. Mercury, the closest planet, zips around the Sun in just 88 days. Earth takes 365 days, one year, to complete its orbit. Neptune, the furthest planet, takes about 165 Earth years.\n\nA common mistake is thinking the Sun orbits the Earth, because from the ground, it looks like the Sun moves across the sky above us. Actually, it's the Earth that is moving, both spinning and orbiting the Sun, and this movement is what makes the Sun appear to travel across our sky.\n\nAnother mistake is picturing all the planets as roughly the same size and close together, like they're often drawn in simple classroom diagrams. In reality, the distances between planets are enormous, and the planets vary hugely in size, Jupiter alone could fit more than a thousand Earths inside it. Diagrams in books are never drawn to true scale.\n\nNow you'll practise ordering the planets and describing what an orbit is.",
          starterQuiz: [
            { kind: "mc", question: "What shape is the Earth?", correct: ["A sphere, like a giant ball"], distractors: ["Flat, like a disc", "A cube", "A cylinder"] },
            { kind: "mc", question: "What is the Sun?", correct: ["A huge, glowing star"], distractors: ["A planet", "A moon", "A comet"] },
            { kind: "short", question: "What force pulls objects towards the Earth?", answers: ["gravity"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "Which planet is closest to the Sun?", correct: ["Mercury"], distractors: ["Venus", "Earth", "Mars"] },
            { kind: "mc", question: "What is an orbit?", correct: ["The curved path an object takes around another object in space"], distractors: ["The spin of a planet on its axis", "A type of star", "The surface of a planet"] },
            { kind: "short", question: "How many planets are in the solar system?", answers: ["8", "eight"] },
            { kind: "match", question: "Match each planet to its position from the Sun.", pairs: [["Earth", "3rd planet from the Sun"], ["Mars", "4th planet from the Sun"], ["Mercury", "1st planet from the Sun"]] },
            { kind: "order", question: "Order these planets from closest to the Sun to furthest: Mars, Mercury, Venus, Earth.", items: ["Mercury", "Venus", "Earth", "Mars"] },
          ],
          worksheet: [
            { text: "Name the planet that is closest to the Sun.", type: "short", answer: "Mercury" },
            { text: "Name the planet that is fourth from the Sun.", type: "short", answer: "Mars" },
            { text: "What is an orbit? Give your answer in one sentence.", type: "short", answer: "the curved path an object takes as it travels around another object in space" },
            { text: "Explain why planets closer to the Sun take less time to complete an orbit than planets further away.", type: "extended", answer: "A good answer recognises that planets closer to the Sun have a shorter path to travel around, so they complete one full orbit more quickly than planets further away, which have a much longer path to travel." },
          ],
        },
        {
          slug: "day-and-night-earths-rotation",
          title: "Day and night: the Earth's rotation",
          pupilLessonOutcome: "I can explain how the Earth's rotation causes day and night.",
          keyLearningPoints: [
            "The Earth spins on its own axis, an imaginary line through the middle from the North Pole to the South Pole, once every 24 hours.",
            "Day happens on the side of the Earth facing the Sun; night happens on the side facing away from the Sun.",
            "The Sun does not move across the sky; the Earth's rotation makes it look as though the Sun is moving.",
            "One full rotation of the Earth takes 24 hours, which is why a day is 24 hours long.",
          ],
          keywords: [
            { keyword: "rotate", description: "To spin around on an axis, like a top spinning." },
            { keyword: "axis", description: "An imaginary line through the middle of a planet, around which it spins." },
            { keyword: "rotation", description: "One complete spin of the Earth on its axis, which takes 24 hours." },
          ],
          misconceptions: [
            { misconception: "Pupils think the Sun moves across the sky during the day, rather than the Earth spinning.", response: "Use a torch and a globe (or a ball) in a darkened room to show that as the globe spins, different places move into and out of the torch's light, demonstrating that it is the Earth's spin, not the Sun's movement, that causes the appearance of the Sun crossing the sky." },
            { misconception: "Pupils think day and night happen because the Sun switches on and off, or because clouds cover the Sun at night.", response: "Clarify using the torch and globe model that the Sun keeps shining constantly; night happens simply because that part of the Earth has spun round to face away from the Sun, not because the Sun has gone out." },
          ],
          teacherTips: [
            "Physically model rotation using a globe and a torch (or lamp) in a darkened room, spinning the globe slowly so pupils can see day and night moving across its surface in real time.",
            "Reinforce vocabulary carefully: rotation (spinning on its own axis, causing day and night) is different from orbit (travelling around the Sun, causing a year), and pupils often muddle the two.",
          ],
          transcript:
            "Hello! Today we're finding out what really causes day and night.\n\nYou might think the Sun moves across the sky during the day, rising in the morning and setting at night. But actually, the Sun stays roughly still. It's the Earth that is moving.\n\nThe Earth spins, all the way round, on an imaginary line running straight through it called an axis, from the North Pole to the South Pole. This spinning is called rotation. The Earth completes one full rotation, one whole spin, every 24 hours.\n\nAs the Earth spins, different parts of it face towards the Sun, and different parts face away. Wherever it is facing the Sun, that part of the Earth experiences daytime, because sunlight is reaching it. Wherever it is facing away from the Sun, that part experiences night-time, because sunlight cannot reach it.\n\nImagine shining a torch at a ball in a dark room, and slowly spinning that ball. The side facing the torch is lit up, that's daytime. The side facing away is in darkness, that's night-time. As the ball keeps spinning, different parts move into and out of the torchlight, just like different parts of the Earth move into and out of sunlight as it rotates.\n\nBecause one full rotation takes 24 hours, that's why a day is 24 hours long, it's the time it takes for any point on Earth to spin all the way round and experience both day and night once.\n\nHere's a mistake to watch for. Some people think the Sun moves across the sky, rising and setting, but really it's us who are moving, spinning on the Earth. What looks like the Sun travelling from east to west is actually the Earth rotating from west to east.\n\nAnother mistake is thinking night happens because the Sun switches off, or gets covered by clouds. The Sun is shining constantly. Night simply happens because our part of the Earth has spun around to face away from it.\n\nNow you're going to model day and night using a torch and a globe.",
          starterQuiz: [
            { kind: "mc", question: "What is the Sun?", correct: ["A huge, glowing star"], distractors: ["A planet", "A moon", "A galaxy"] },
            { kind: "mc", question: "How many planets orbit the Sun?", correct: ["8"], distractors: ["7", "9", "10"] },
            { kind: "short", question: "What force keeps planets in orbit around the Sun?", answers: ["gravity"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What causes day and night?", correct: ["The Earth rotating on its axis"], distractors: ["The Sun moving around the Earth", "The Sun switching on and off", "Clouds covering the Sun"] },
            { kind: "mc", question: "How long does one full rotation of the Earth take?", correct: ["24 hours"], distractors: ["12 hours", "365 days", "1 hour"] },
            { kind: "short", question: "What do we call the imaginary line the Earth spins around?", answers: ["axis", "its axis"] },
            { kind: "match", question: "Match each term to its correct meaning.", pairs: [["rotation", "the Earth spinning on its own axis"], ["orbit", "a planet travelling around the Sun"], ["axis", "the imaginary line a planet spins around"]] },
            { kind: "order", question: "Order these events as the Earth rotates over 24 hours, starting from midday where you live.", items: ["midday (facing the Sun)", "evening", "midnight (facing away from the Sun)", "morning"] },
          ],
          worksheet: [
            { text: "What is the name for the imaginary line the Earth spins around?", type: "short", answer: "axis" },
            { text: "How long does it take the Earth to complete one full rotation?", type: "short", answer: "24 hours" },
            { text: "Explain, using the word 'rotation', why different parts of the Earth experience day and night at different times.", type: "extended", answer: "A good answer explains that as the Earth rotates on its axis, the side facing the Sun experiences day, while the side facing away experiences night, and because the Earth keeps turning, every part of it moves through both day and night during one rotation." },
            { text: "Explain why it is incorrect to say 'the Sun moves across the sky'.", type: "extended", answer: "A good answer explains that the Sun stays roughly still while the Earth rotates, and it is this rotation that makes the Sun appear to move across the sky from our point of view, rather than the Sun actually moving around the Earth." },
          ],
        },
        {
          slug: "the-moon-and-its-phases",
          title: "The Moon and its phases",
          pupilLessonOutcome: "I can explain why the Moon appears to change shape over the course of a month.",
          keyLearningPoints: [
            "The Moon does not produce its own light; it appears bright because it reflects light from the Sun.",
            "The Moon orbits the Earth, taking about 27 to 29 days to complete one full orbit.",
            "The Moon's apparent shape, or phase, changes because we see different amounts of its sunlit half as it orbits the Earth.",
            "The main phases, in order, are new moon, waxing crescent, first quarter, waxing gibbous, full moon, then the same stages in reverse as it wanes back to new moon.",
          ],
          keywords: [
            { keyword: "reflect", description: "To bounce light off a surface, rather than producing light itself." },
            { keyword: "orbit", description: "The path an object takes as it travels around another object in space." },
            { keyword: "phase", description: "The changing shape of the Moon as seen from Earth, caused by how much of its sunlit side we can see." },
          ],
          misconceptions: [
            { misconception: "Pupils think the Moon produces its own light, like the Sun does.", response: "Explain clearly that the Moon has no light of its own; what we see is sunlight bouncing, or reflecting, off the Moon's surface and travelling to our eyes." },
            { misconception: "Pupils think the Moon's phases are caused by the Earth's shadow falling on it, confusing phases with a lunar eclipse.", response: "Clarify that phases happen because we see different amounts of the Moon's sunlit half as it orbits the Earth; the Earth's shadow causing an eclipse is a much rarer, separate event." },
          ],
          teacherTips: [
            "Use a torch, a small ball (the Moon) and a person's head (the Earth) to model phases: hold the ball at different points in an orbit around your head, keeping the torch shining from one direction, and look at how much of the lit side is visible each time.",
            "Display a simple phase diagram in order and refer back to it regularly, since remembering the sequence of phases takes repeated practice.",
          ],
          transcript:
            "Hello! Today we're exploring the Moon, and working out why it seems to change shape throughout the month.\n\nFirst, an important fact: the Moon does not make its own light. It might look like it's glowing, but really it's reflecting light from the Sun, just like a mirror bounces light back at you. Half of the Moon is always lit up by the Sun, just like half of the Earth always has daytime, while the other half is always in darkness.\n\nThe Moon orbits the Earth, travelling all the way around it roughly every 27 to 29 days, which is about a month. As the Moon moves along its orbit, we on Earth see different amounts of its sunlit half, and this is what causes its apparent shape, or phase, to change.\n\nWhen the Moon is between the Earth and the Sun, the sunlit half is facing away from us, so we can barely see it at all, this is called a new moon. As the Moon continues its orbit, we gradually see more of its sunlit side: first a thin sliver, called a waxing crescent, then a half circle, called first quarter, then most of the circle, called waxing gibbous, until eventually we see the whole sunlit side facing us, a full moon. After that, the visible sunlit portion shrinks again, through the same stages in reverse, until it disappears back to a new moon, and the cycle begins again.\n\nHere's a mistake to clear up. The Moon's phases are not caused by the Earth's shadow falling on it, that's a different, much rarer event called a lunar eclipse. Phases happen simply because of how much of the Moon's constantly sunlit half we can see from our position on Earth as it travels around us.\n\nAnother mistake is thinking the Moon makes its own light. Remember, it's reflecting sunlight, like a giant mirror in the sky, bouncing sunlight down towards Earth.\n\nNow you'll practise putting the Moon's phases in order and explaining what causes them.",
          starterQuiz: [
            { kind: "mc", question: "What causes day and night on Earth?", correct: ["The Earth rotating on its axis"], distractors: ["The Sun moving around the Earth", "The Moon blocking the Sun", "The Earth orbiting the Sun"] },
            { kind: "mc", question: "Roughly how long does it take the Earth to orbit the Sun?", correct: ["365 days"], distractors: ["24 hours", "27 days", "100 days"] },
            { kind: "short", question: "What force keeps the Moon in orbit around the Earth?", answers: ["gravity"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "Why does the Moon appear bright in the sky?", correct: ["It reflects light from the Sun"], distractors: ["It produces its own light", "It absorbs starlight", "It is on fire"] },
            { kind: "mc", question: "Roughly how long does the Moon take to orbit the Earth?", correct: ["27 to 29 days"], distractors: ["24 hours", "365 days", "7 days"] },
            { kind: "short", question: "What do we call the changing shape of the Moon as seen from Earth?", answers: ["phases", "a phase"] },
            { kind: "match", question: "Match each Moon phase to its description.", pairs: [["New moon", "the Moon is barely visible"], ["Full moon", "the whole sunlit side faces Earth"], ["First quarter", "half of the visible side is lit"]] },
            { kind: "order", question: "Order these Moon phases as they occur after a new moon.", items: ["waxing crescent", "first quarter", "waxing gibbous", "full moon"] },
          ],
          worksheet: [
            { text: "Why does the Moon appear to shine?", type: "short", answer: "it reflects sunlight" },
            { text: "Roughly how many days does it take the Moon to complete one orbit of the Earth?", type: "short", answer: "about 27 to 29 days" },
            { text: "Explain why we see a full moon at one point in the month and a new moon at another point, using the word 'orbit' in your answer.", type: "extended", answer: "A good answer explains that as the Moon orbits the Earth, we see different amounts of its sunlit half; a full moon happens when we see all of the sunlit side, and a new moon happens when the sunlit side is facing away from us." },
            { text: "Explain why the Moon's phases are not caused by the Earth's shadow.", type: "extended", answer: "A good answer explains that phases are caused by seeing different amounts of the Moon's constantly sunlit half as it orbits Earth, whereas the Earth's shadow falling on the Moon is a separate, much rarer event called a lunar eclipse." },
          ],
        },
      ],
    },
  ],
};
