import type { SubjectYearSpec } from "./types";

export const scienceYear7: SubjectYearSpec = {
  subject: { slug: "science", title: "Science" },
  programme: {
    sequenceSlug: "science-secondary",
    yearGroup: 7,
    keyStage: "ks3",
    phase: "secondary",
    title: "Science — Year 7",
  },
  units: [
    {
      slug: "cells-and-organisation",
      title: "Cells and organisation",
      description:
        "Pupils learn that all living things are made of cells, compare animal and plant cells, meet specialised cells with jobs to do, and learn how substances move into and out of cells.",
      whyThisWhyNow:
        "Cells are the starting point for the whole of biology at secondary school: organ systems, reproduction, and later genetics all rest on understanding what a cell is and how it works. This unit builds directly on the simple 'living things are made of parts' ideas pupils meet in primary science.",
      priorKnowledge: [
        "Pupils can describe the basic needs of animals, including humans, for survival.",
        "Pupils know that humans and animals have offspring which grow into adults.",
        "Pupils have used a hand lens or simple microscope to look closely at living things.",
      ],
      nationalCurriculum: [
        "Cells as the fundamental unit of living organisms, including how to observe, interpret and record cell structure using a light microscope.",
        "The functions of the different parts of animal and plant cells.",
        "The similarities and differences between animal and plant cells.",
        "The role of diffusion in the movement of materials in and between cells.",
      ],
      lessons: [
        {
          slug: "cells-animal-and-plant-cells",
          title: "Animal and plant cells",
          pupilLessonOutcome:
            "I can label the main parts of an animal cell and a plant cell and explain what each part does.",
          keyLearningPoints: [
            "All living things are made of cells, which are the smallest unit of life.",
            "Animal cells have a nucleus, cytoplasm and cell membrane; plant cells have these too, plus a cell wall, a permanent vacuole and chloroplasts.",
            "The nucleus controls the cell's activities and contains genetic material; the cytoplasm is where most chemical reactions happen; the cell membrane controls what enters and leaves the cell.",
            "The cell wall gives a plant cell a fixed shape and support; chloroplasts contain chlorophyll and are where photosynthesis takes place.",
          ],
          keywords: [
            { keyword: "nucleus", description: "The part of a cell that contains genetic material and controls the cell's activities." },
            { keyword: "cytoplasm", description: "The jelly-like substance filling a cell, where many chemical reactions take place." },
            { keyword: "chloroplast", description: "A structure found only in plant cells, containing chlorophyll, where photosynthesis happens." },
          ],
          misconceptions: [
            { misconception: "Pupils think all cells look the same, like a plain brick or box.", response: "Show real microscope images of several different cell types side by side and point out that cells vary enormously in shape depending on their job, even though most share the same basic parts." },
            { misconception: "Pupils think plant cells don't have a nucleus, cytoplasm or membrane because lessons focus on the 'extra' parts like the cell wall.", response: "Be explicit that a plant cell has everything an animal cell has, plus three extra structures — the cell wall, vacuole and chloroplasts — it never has fewer parts." },
          ],
          teacherTips: [
            "Use a labelled diagram alongside a real onion cell or cheek cell microscope image so pupils connect the neat diagram to what a cell actually looks like under a microscope.",
            "Introduce the animal cell first, then build the plant cell 'on top of it' by adding the three extra structures, to reinforce that plant cells are not a completely different thing.",
          ],
          transcript:
            "Welcome to Year 7 science. We're starting with one of the biggest ideas in biology: every living thing you have ever seen, from an ant to an oak tree to you, is built from cells. A cell is the smallest unit of life, and most cells are so small you need a microscope to see them.\n\nLet's start with an animal cell, like one from the lining of your cheek. It has three main parts. The nucleus is a dense, roughly round structure that acts like the cell's control centre — it contains the genetic material that tells the cell what to do and, when the cell divides, how to build a copy of itself. Around the nucleus is the cytoplasm, a jelly-like substance that fills most of the cell. This is where most of the cell's chemical reactions happen. Surrounding everything is the cell membrane, a thin skin that holds the cell together and controls exactly what substances are allowed to enter or leave.\n\nA plant cell, for example from a leaf, has all three of those same parts — nucleus, cytoplasm, membrane — but it also has three extra structures that animal cells don't have. First, a rigid cell wall sits just outside the membrane, giving the cell a fixed, box-like shape and support, a bit like scaffolding. Second, a large permanent vacuole, filled with a watery liquid called cell sap, helps keep the cell firm. Third, plant cells contain chloroplasts, small green structures packed with a chemical called chlorophyll, which is where photosynthesis happens — the process that lets plants make their own food using sunlight.\n\nSo remember, a plant cell isn't a different kind of thing from an animal cell — it's an animal cell's basic parts, plus three extra ones for the plant's particular job of standing upright and making food from light.\n\nA common trap is thinking every cell looks identical, like a plain box. In reality cells come in all sorts of shapes depending on their job, which is exactly what we'll explore in our next lesson on specialised cells. For now, make sure you can draw and label a simple animal cell and a simple plant cell, and explain what each labelled part does.",
          starterQuiz: [
            { kind: "mc", question: "Which of these is a basic need of all living things?", correct: ["Food and water"], distractors: ["A skeleton", "Green colouring", "Wings"] },
            { kind: "mc", question: "What tool can you use to see very small living things more clearly?", correct: ["A microscope"], distractors: ["A ruler", "A thermometer", "A stopwatch"] },
            { kind: "short", question: "True or false: all living things grow and reproduce.", answers: ["true", "True"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "Which part of a cell controls its activities and contains genetic material?", correct: ["Nucleus"], distractors: ["Cytoplasm", "Cell membrane", "Cell wall"] },
            { kind: "mc", question: "Which structures are found in a plant cell but NOT in an animal cell? (select all that apply)", correct: ["Cell wall", "Chloroplast"], distractors: ["Nucleus", "Cytoplasm"] },
            { kind: "short", question: "What is the job of the cell membrane?", answers: ["controls what enters and leaves the cell", "controls what goes in and out of the cell"] },
            { kind: "match", question: "Match each cell part to its function.", pairs: [["Nucleus", "Controls the cell's activities"], ["Chloroplast", "Site of photosynthesis"], ["Cell wall", "Gives the cell a fixed shape and support"]] },
            { kind: "order", question: "Order these structures from the outside of a plant cell to the innermost part: cell wall, cell membrane, cytoplasm, nucleus.", items: ["cell wall", "cell membrane", "cytoplasm", "nucleus"] },
          ],
          worksheet: [
            { text: "Name two cell parts found in both animal cells and plant cells.", type: "short", answer: "nucleus and cytoplasm (or nucleus and cell membrane, or cytoplasm and cell membrane)" },
            { text: "Which cell part is the site of photosynthesis?", type: "short", answer: "chloroplast" },
            { text: "Draw and label a plant cell, showing at least five labelled parts.", type: "extended" },
            { text: "Explain why a plant cell needs a cell wall but an animal cell does not.", type: "extended" },
          ],
        },
        {
          slug: "cells-specialised-cells",
          title: "Specialised cells",
          pupilLessonOutcome:
            "I can explain how the structure of a specialised cell relates to the job it does in the body.",
          keyLearningPoints: [
            "A specialised cell has a structure adapted to carry out a particular job.",
            "A red blood cell has no nucleus and a biconcave (dimpled disc) shape, giving it more space to carry oxygen.",
            "A sperm cell has a long tail (flagellum) for swimming and lots of mitochondria to release the energy needed for movement.",
            "A root hair cell has a long, thin extension that increases its surface area for absorbing water and minerals from the soil.",
          ],
          keywords: [
            { keyword: "specialised cell", description: "A cell with a structure adapted to carry out a particular function in the body." },
            { keyword: "adaptation", description: "A feature of a cell (or organism) that suits it to its function or environment." },
            { keyword: "surface area", description: "The amount of outer surface a structure has, which affects how quickly substances can move across it." },
          ],
          misconceptions: [
            { misconception: "Pupils think a cell 'chooses' or 'decides' to change its structure to suit its job.", response: "Explain that a cell's structure develops as it is being formed for that role; the cell does not consciously adapt itself, it simply grows with the structure suited to its function from early on." },
            { misconception: "Pupils think all specialised cells must look complicated or unusual, so they assume something like a red blood cell without a nucleus is 'broken' or 'incomplete'.", response: "Clarify that losing the nucleus is a useful adaptation for a red blood cell, freeing up more internal space to carry oxygen, rather than a fault." },
          ],
          teacherTips: [
            "Ask pupils to predict a cell's job just from its shape before revealing the correct answer, to build the habit of linking structure to function.",
            "Keep coming back to the sentence stem 'this cell has ___, which helps it to ___', as this is exactly the reasoning examiners look for.",
          ],
          transcript:
            "Last lesson we looked at the basic animal cell and plant cell. Today we're looking at specialised cells — cells whose shape and structure are adapted to do one particular job especially well.\n\nLet's start with the red blood cell, which carries oxygen around your body. A red blood cell has an unusual biconcave shape, like a disc with a dimple pressed into each side. This shape gives it a large surface area compared to its size, which helps oxygen move in and out quickly. Even more surprising, a mature red blood cell has no nucleus at all. Losing the nucleus isn't a mistake — it frees up extra space inside the cell to pack in more of the substance, haemoglobin, that carries oxygen. So every part of its structure is suited to its one job: transporting oxygen efficiently.\n\nNext, think about a sperm cell, whose job is to swim to an egg cell and fertilise it. A sperm cell has a long, whip-like tail called a flagellum, which it lashes from side to side to swim. Just behind the head, it's packed with mitochondria, tiny structures that release the energy the cell needs to power that swimming tail. Again, structure matches function: a tail for movement, and lots of energy-releasing mitochondria to drive that movement.\n\nNow consider a root hair cell in a plant, whose job is to absorb water and dissolved minerals from the soil. It has a long, thin, hair-like extension poking out into the soil. This extension massively increases the cell's surface area, giving it much more contact with the soil water around it, so it can absorb water faster.\n\nNotice the pattern in every example: the cell's structure is not random, it directly helps the cell carry out its function. A common mistake is to think the cell somehow decides to change itself — it doesn't; it simply develops with the structure that suits its job from the start. Next lesson we'll look at how substances actually move in and out of cells like these.",
          starterQuiz: [
            { kind: "mc", question: "What is the job of the cell membrane?", correct: ["Controls what enters and leaves the cell"], distractors: ["Makes food using sunlight", "Contains the genetic material", "Gives the cell a fixed shape"] },
            { kind: "mc", question: "Which of these is found in a plant cell but not an animal cell?", correct: ["Cell wall"], distractors: ["Nucleus", "Cytoplasm", "Cell membrane"] },
            { kind: "short", question: "What structure controls a cell's activities and contains genetic material?", answers: ["nucleus"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "Why does a red blood cell have no nucleus?", correct: ["To make more space to carry oxygen"], distractors: ["Because it is not fully grown", "Because it does not need to survive long", "Because it is a plant cell"] },
            { kind: "mc", question: "Which features help a sperm cell to swim and move? (select all that apply)", correct: ["A long tail (flagellum)", "Lots of mitochondria for energy"], distractors: ["A cell wall", "A large permanent vacuole"] },
            { kind: "short", question: "What does a root hair cell's long extension increase, helping it absorb water faster?", answers: ["surface area", "its surface area"] },
            { kind: "match", question: "Match each specialised cell to the feature that helps it do its job.", pairs: [["Red blood cell", "Biconcave shape with no nucleus"], ["Sperm cell", "Long tail and many mitochondria"], ["Root hair cell", "Long, thin extension for absorbing water"]] },
            { kind: "order", question: "Order these statements to build the correct explanation of the sperm cell: the sperm cell must swim to the egg, it has a tail called a flagellum, the tail needs energy to move, mitochondria near the tail release that energy.", items: ["the sperm cell must swim to the egg", "it has a tail called a flagellum", "the tail needs energy to move", "mitochondria near the tail release that energy"] },
          ],
          worksheet: [
            { text: "Name one adaptation of a red blood cell and explain how it helps the cell's function.", type: "short", answer: "Its biconcave shape gives a larger surface area for oxygen to move in and out (or it has no nucleus, giving more space to carry oxygen)." },
            { text: "Name the structure a sperm cell uses to swim.", type: "short", answer: "flagellum (tail)" },
            { text: "Explain why a root hair cell has a long, thin extension.", type: "extended" },
            { text: "Choose one specialised cell from this lesson and describe, in full sentences, how its structure suits its function.", type: "extended" },
          ],
        },
        {
          slug: "cells-diffusion-and-movement-of-substances",
          title: "Diffusion and the movement of substances",
          pupilLessonOutcome:
            "I can explain diffusion and describe how it moves substances into and out of cells.",
          keyLearningPoints: [
            "Diffusion is the net movement of particles from an area of higher concentration to an area of lower concentration.",
            "Diffusion happens because particles are always moving randomly; it does not require the cell to use energy.",
            "Oxygen moves into cells by diffusion because cells constantly use it up, keeping its concentration lower inside than outside.",
            "Carbon dioxide, a waste product of respiration, moves out of cells by diffusion for the same reason, in the opposite direction.",
          ],
          keywords: [
            { keyword: "diffusion", description: "The net movement of particles from an area of higher concentration to an area of lower concentration." },
            { keyword: "concentration", description: "How crowded together particles of a substance are in a given space; a higher concentration means more particles packed into the same space." },
            { keyword: "concentration gradient", description: "The difference in concentration between two areas, which determines the direction particles diffuse in." },
          ],
          misconceptions: [
            { misconception: "Pupils think diffusion requires the cell to actively pull particles in, using energy.", response: "Stress that diffusion is a passive process — particles are always moving randomly on their own, and diffusion is simply the overall pattern this random movement produces, needing no energy from the cell." },
            { misconception: "Pupils think particles stop moving once concentration is equal on both sides.", response: "Explain that particles keep moving randomly forever; once concentration is equal, movement in both directions balances out, so there is no further NET movement, even though individual particles are still moving." },
          ],
          teacherTips: [
            "Use the smell of perfume spreading across a room as an everyday example pupils can picture before applying the idea to cells.",
            "Draw two boxes with dots of different densities and an arrow showing net movement, to make the 'higher to lower concentration' rule visual rather than just verbal.",
          ],
          transcript:
            "In the last two lessons we looked at the structure of cells. Today we look at how substances actually get into and out of a cell, through a process called diffusion.\n\nImagine someone opens a bottle of perfume at the front of a room. At first the perfume particles are crowded together near the bottle — a high concentration in one small area. Gradually, you start to smell it further and further away, until eventually the smell has spread evenly through the whole room. That spreading out is diffusion: the net movement of particles from an area where they are more crowded together, a higher concentration, to an area where they are more spread out, a lower concentration.\n\nWhy does this happen? Particles of gases and liquids are always moving about randomly, bumping into each other and everything around them. Diffusion isn't the particles deciding to move somewhere — it's simply what happens naturally when there are more particles in one place than another: because there's more random movement happening in the crowded area, more particles end up randomly wandering into the empty space than wander back the other way, until things even out. Crucially, this doesn't need the cell to use any energy at all; it happens on its own.\n\nNow let's apply this to a real cell. Your cells are constantly using up oxygen during respiration, the process that releases energy from food. This keeps the concentration of oxygen inside the cell lower than the concentration of oxygen in the blood just outside it. Because there's a higher concentration outside and a lower concentration inside, oxygen diffuses into the cell, moving down this concentration gradient. At the very same time, respiration produces carbon dioxide as a waste product, so the concentration of carbon dioxide builds up inside the cell, becoming higher than outside. So carbon dioxide diffuses out of the cell, again moving from high to low concentration.\n\nA common mistake is thinking the cell has to actively pull oxygen in, using energy — it doesn't; diffusion is a passive process that happens automatically because of the concentration difference. Make sure you can explain, using the words 'higher concentration' and 'lower concentration', why oxygen diffuses in and carbon dioxide diffuses out of a cell.",
          starterQuiz: [
            { kind: "mc", question: "What gas do living cells need for respiration?", correct: ["Oxygen"], distractors: ["Nitrogen", "Carbon dioxide", "Hydrogen"] },
            { kind: "mc", question: "What waste gas is produced during respiration?", correct: ["Carbon dioxide"], distractors: ["Oxygen", "Water vapour only", "Nitrogen"] },
            { kind: "short", question: "What is the process called that releases energy from food inside cells?", answers: ["respiration"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What is diffusion?", correct: ["The net movement of particles from a higher to a lower concentration"], distractors: ["The movement of particles from low to high concentration", "The cell actively pumping particles in", "Particles staying completely still"] },
            { kind: "mc", question: "Which of these statements about diffusion are true? (select all that apply)", correct: ["It does not require the cell to use energy", "It happens because particles move randomly"], distractors: ["It only happens inside plant cells", "It requires the cell to use energy"] },
            { kind: "short", question: "Does oxygen diffuse into or out of a respiring cell?", answers: ["into", "into the cell"] },
            { kind: "match", question: "Match each substance to the direction it diffuses in a respiring cell.", pairs: [["Oxygen", "Diffuses into the cell"], ["Carbon dioxide", "Diffuses out of the cell"], ["Perfume in a room", "Diffuses from high to low concentration"]] },
            { kind: "order", question: "Order these steps to explain why oxygen diffuses into a cell: the cell uses up oxygen in respiration, this keeps oxygen concentration low inside the cell, oxygen concentration is higher outside the cell, oxygen diffuses from the higher concentration outside to the lower concentration inside.", items: ["the cell uses up oxygen in respiration", "this keeps oxygen concentration low inside the cell", "oxygen concentration is higher outside the cell", "oxygen diffuses from the higher concentration outside to the lower concentration inside"] },
          ],
          worksheet: [
            { text: "Define diffusion in your own words.", type: "short", answer: "The net movement of particles from an area of higher concentration to an area of lower concentration." },
            { text: "A perfume bottle is opened in the corner of a room. After ten minutes people across the whole room can smell it. What process explains this?", type: "short", answer: "diffusion" },
            { text: "Explain why carbon dioxide diffuses out of a respiring cell, using the words 'concentration' and 'diffusion'.", type: "extended" },
            { text: "Explain why diffusion does not require the cell to use energy.", type: "extended" },
          ],
        },
      ],
    },
    {
      slug: "forces",
      title: "Forces",
      description:
        "Pupils learn to identify contact and non-contact forces, understand the difference between balanced and unbalanced forces, and calculate speed from distance and time.",
      whyThisWhyNow:
        "Forces underpin the whole of KS3 and GCSE physics, from motion to energy to Newton's laws. This unit gives pupils the vocabulary and basic quantitative skills (measuring, calculating speed) they will build on throughout secondary science.",
      priorKnowledge: [
        "Pupils know that a push or a pull can make an object start, stop, speed up, slow down or change direction.",
        "Pupils can compare how objects move on different surfaces.",
        "Pupils can use simple measuring equipment such as a ruler or stopwatch.",
      ],
      nationalCurriculum: [
        "Describe simple compression, tension and shearing forces and their effects.",
        "Identify the forces acting on an object and whether they are balanced or unbalanced.",
        "Understand how forces measured in newtons cause changes in motion.",
        "Calculate average speed and interpret distance-time relationships.",
      ],
      lessons: [
        {
          slug: "forces-contact-and-non-contact-forces",
          title: "Contact and non-contact forces",
          pupilLessonOutcome:
            "I can identify a force as either a contact force or a non-contact force and give examples of each.",
          keyLearningPoints: [
            "A force is a push or a pull that can change an object's speed, direction or shape.",
            "Forces are measured in newtons (N) using a device called a newton meter.",
            "A contact force acts only when two objects are touching, such as friction, air resistance and normal contact force.",
            "A non-contact force acts between objects that are not touching, such as gravity, magnetism and electrostatic force.",
          ],
          keywords: [
            { keyword: "force", description: "A push or a pull acting on an object, which can change its speed, direction or shape." },
            { keyword: "contact force", description: "A force that only acts when two objects are physically touching, e.g. friction." },
            { keyword: "non-contact force", description: "A force that can act between two objects even when they are not touching, e.g. gravity." },
          ],
          misconceptions: [
            { misconception: "Pupils think gravity only acts when something is falling, and switches off when an object is sitting still.", response: "Explain that gravity acts on an object all the time, even when it is at rest on a table; the table simply provides an equal contact force pushing back, which is why the object doesn't move." },
            { misconception: "Pupils think a magnet attracting a paperclip from a distance must be a contact force because they can 'see it happening'.", response: "Point out that the magnet and paperclip are not touching at the moment the pull begins, which is exactly what makes magnetism a non-contact force — you can observe an effect without any touching." },
          ],
          teacherTips: [
            "Build a simple table on the board as examples come up, with two columns headed 'contact' and 'non-contact', and sort each new force into it as a class.",
            "Use a real magnet and paperclip, and a dropped object, as quick live demonstrations rather than only describing them.",
          ],
          transcript:
            "Today we're starting a new topic: forces. A force is simply a push or a pull. Forces can make an object start moving, stop moving, speed up, slow down, change direction, or even change shape, like squashing a sponge. We measure the size of a force in a unit called the newton, written N, using a device called a newton meter.\n\nForces come in two broad types, depending on whether the objects involved are touching. A contact force only acts when two objects are physically touching each other. Friction is a good example — when you slide a book across a table, friction between the book and the table surface acts to slow it down, and friction only exists while the two surfaces are in contact. Air resistance is another contact force; it's caused by air particles colliding with a moving object, so again, contact is needed. When you lean on a wall, the wall pushes back on you with what we call a normal contact force — again, only possible because you're touching it.\n\nA non-contact force, on the other hand, can act between two objects even when they are not touching at all. Gravity is the best-known example. Gravity pulls every object with mass towards every other object with mass, and it works across empty space — it's why the Moon orbits the Earth even though nothing physically connects them. Magnetism is another non-contact force: a strong magnet can pull a paperclip towards it before they ever touch. Electrostatic force is a third example — you may have seen a balloon rubbed on a jumper pick up small pieces of paper without ever touching them, because of static electricity.\n\nA common misunderstanding is thinking gravity switches off once an object is resting on a surface, like a book on a table. Actually, gravity is still pulling the book downwards the whole time; the table is simply pushing back upwards with an equal contact force, which is why the book stays still rather than falling. We'll explore exactly this idea of forces balancing each other out in our next lesson.",
          starterQuiz: [
            { kind: "mc", question: "What can a push or a pull do to an object?", correct: ["Change its speed or direction"], distractors: ["Change its colour", "Change its temperature only", "Nothing at all"] },
            { kind: "mc", question: "Which surface would you expect to slow a sliding box down the most?", correct: ["A rough carpet"], distractors: ["Smooth ice", "Polished wood", "Glass"] },
            { kind: "short", question: "Name one piece of equipment you could use to measure something.", answers: ["ruler", "stopwatch", "a ruler", "a stopwatch", "thermometer", "a thermometer"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What unit are forces measured in?", correct: ["Newtons"], distractors: ["Metres", "Seconds", "Kilograms"] },
            { kind: "mc", question: "Which of these are contact forces? (select all that apply)", correct: ["Friction", "Air resistance"], distractors: ["Gravity", "Magnetism"] },
            { kind: "short", question: "Name the force that pulls all objects with mass towards each other and can act at a distance.", answers: ["gravity"] },
            { kind: "match", question: "Match each force to its correct type.", pairs: [["Friction", "Contact force"], ["Gravity", "Non-contact force"], ["Magnetism", "Non-contact force"]] },
            { kind: "order", question: "Order these forces from most obviously 'contact' to most obviously 'non-contact': friction between two surfaces, air resistance on a falling leaf, static electricity attracting paper, gravity pulling the Moon towards Earth.", items: ["friction between two surfaces", "air resistance on a falling leaf", "static electricity attracting paper", "gravity pulling the Moon towards Earth"] },
          ],
          worksheet: [
            { text: "Name two examples of contact forces.", type: "short", answer: "friction and air resistance (or normal contact force)" },
            { text: "What device is used to measure the size of a force?", type: "short", answer: "a newton meter" },
            { text: "A book rests on a table. Explain why the book does not fall, even though gravity is still acting on it.", type: "extended" },
            { text: "Explain why magnetism is classed as a non-contact force, using an example.", type: "extended" },
          ],
        },
        {
          slug: "forces-balanced-and-unbalanced-forces",
          title: "Balanced and unbalanced forces",
          pupilLessonOutcome:
            "I can determine whether the forces on an object are balanced or unbalanced and predict the effect on its motion.",
          keyLearningPoints: [
            "When two or more forces acting on an object are equal in size and opposite in direction, they are balanced, and the object's motion does not change.",
            "When forces on an object are unbalanced, there is a net (resultant) force, which changes the object's speed or direction.",
            "An object that is stationary or moving at a constant speed in a straight line has balanced forces acting on it.",
            "The resultant force is found by working out the difference between forces acting in opposite directions.",
          ],
          keywords: [
            { keyword: "balanced forces", description: "Forces acting on an object that are equal in size and opposite in direction, producing no change in motion." },
            { keyword: "resultant force", description: "The single overall force that has the same effect as all the individual forces acting on an object combined." },
            { keyword: "unbalanced force", description: "A situation where the forces on an object do not cancel out, causing a change in speed or direction." },
          ],
          misconceptions: [
            { misconception: "Pupils think balanced forces mean there are no forces acting on the object at all.", response: "Clarify that balanced forces are still forces acting fully — for example gravity and the normal contact force both act on a resting book — they simply cancel each other out because they are equal and opposite." },
            { misconception: "Pupils think a moving object needs a constant unbalanced force just to keep moving at a steady speed.", response: "Explain that an object moving at a constant speed in a straight line actually has balanced forces on it; an unbalanced force is only needed to change how it's moving, not to keep it moving the same way." },
          ],
          teacherTips: [
            "Use a simple tug-of-war diagram with arrows of different lengths to show forces of different sizes, then ask pupils to predict which way (if any) the rope moves.",
            "Explicitly link back to the balanced book-on-a-table example from the previous lesson before introducing new, unbalanced examples.",
          ],
          transcript:
            "In our last lesson we identified contact and non-contact forces. Today we look at what happens when more than one force acts on an object at the same time, and whether those forces are balanced or unbalanced.\n\nThink about a book resting on a table. Gravity pulls the book downward. At the same time, the table pushes up on the book with a normal contact force. If these two forces are exactly equal in size but opposite in direction, we call them balanced forces. When forces are balanced, the object's motion does not change at all — the book stays perfectly still.\n\nNow imagine a game of tug-of-war. If both teams pull with exactly the same strength, the forces are balanced, and the rope stays still, even though both teams are clearly pulling hard. But if one team pulls harder than the other, the forces become unbalanced. There is now a resultant force — an overall force in the direction of the stronger team — and the rope, along with the losing team, accelerates in that direction.\n\nTo find the resultant force when forces act in opposite directions, we simply find the difference between them. If one team pulls with 600 newtons and the other pulls with 500 newtons, the resultant force is 600 minus 500, which is 100 newtons, acting in the direction of the stronger team.\n\nHere's an important rule to remember: an object that is either completely still, or moving at a constant, steady speed in a straight line, always has balanced forces acting on it. It's only when the forces become unbalanced that the object's speed or direction actually changes — it might speed up, slow down, or turn.\n\nA common mistake is thinking that balanced forces mean no forces are acting at all. That's not right — in our book example, gravity and the normal contact force are both very much still acting, fully, on the book; they just happen to cancel each other out perfectly because they are equal and opposite. Another common mistake is thinking you need a constant push to keep something moving steadily — actually, a steady speed in a straight line is exactly what balanced forces produce. Next lesson we'll use ideas about motion to calculate speed.",
          starterQuiz: [
            { kind: "mc", question: "What is a force?", correct: ["A push or a pull"], distractors: ["A type of energy only", "A measurement of speed", "A type of material"] },
            { kind: "mc", question: "Which force pulls objects with mass towards the Earth?", correct: ["Gravity"], distractors: ["Friction", "Magnetism", "Air resistance"] },
            { kind: "short", question: "What unit are forces measured in?", answers: ["newtons", "N"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "What happens to an object's motion when the forces acting on it are balanced?", correct: ["It does not change"], distractors: ["It always speeds up", "It always stops immediately", "It always changes direction"] },
            { kind: "mc", question: "Which of these describe an object with balanced forces acting on it? (select all that apply)", correct: ["Stationary", "Moving at a constant speed in a straight line"], distractors: ["Speeding up", "Turning a corner"] },
            { kind: "short", question: "Two forces of 300N and 200N act in opposite directions on an object. What is the resultant force?", answers: ["100N", "100 N", "100"] },
            { kind: "match", question: "Match each situation to whether the forces are balanced or unbalanced.", pairs: [["A book resting still on a table", "Balanced"], ["A car speeding up from a stop", "Unbalanced"], ["A skater moving at a constant speed in a straight line", "Balanced"]] },
            { kind: "order", question: "Order these steps to find a resultant force acting on a tug-of-war rope: identify the force each team is pulling with, compare the two forces to see which is larger, subtract the smaller force from the larger force, state the resultant force and its direction.", items: ["identify the force each team is pulling with", "compare the two forces to see which is larger", "subtract the smaller force from the larger force", "state the resultant force and its direction"] },
          ],
          worksheet: [
            { text: "Two forces of 450N and 450N act on an object in opposite directions. Are the forces balanced or unbalanced? Explain your answer.", type: "short", answer: "Balanced, because the two forces are equal in size and opposite in direction." },
            { text: "A resultant force acts on a stationary trolley. What will happen to the trolley?", type: "short", answer: "It will start to move (accelerate) in the direction of the resultant force." },
            { text: "Explain why a book resting on a table is not moving, even though gravity is still acting on it.", type: "extended" },
            { text: "A cyclist pedals with a force of 250N forwards while air resistance and friction together push back with 250N. Describe what happens to the cyclist's speed and explain why.", type: "extended" },
          ],
        },
        {
          slug: "forces-calculating-speed",
          title: "Calculating speed",
          pupilLessonOutcome:
            "I can calculate the speed of an object using the equation speed = distance ÷ time.",
          keyLearningPoints: [
            "Speed tells us how far an object travels in a given time.",
            "Speed is calculated using the equation: speed = distance ÷ time.",
            "Speed is commonly measured in metres per second (m/s) when distance is in metres and time is in seconds.",
            "Average speed is used when an object's speed varies during a journey, calculated using the total distance and total time.",
          ],
          keywords: [
            { keyword: "speed", description: "How far an object travels in a given amount of time." },
            { keyword: "distance", description: "The total length of the path travelled by an object, usually measured in metres." },
            { keyword: "average speed", description: "The total distance travelled divided by the total time taken, used when speed varies during a journey." },
          ],
          misconceptions: [
            { misconception: "Pupils confuse the formula and divide time by distance instead of distance by time.", response: "Anchor the formula with a concrete example first: a car travelling 100 metres in 10 seconds is clearly travelling 10 metres every second, so speed = distance ÷ time = 100 ÷ 10 = 10 m/s, not 10 ÷ 100." },
            { misconception: "Pupils think an object's 'average speed' means the speed exactly halfway through the journey.", response: "Clarify that average speed uses the TOTAL distance divided by the TOTAL time for the whole journey, and does not require knowing the speed at any single moment." },
          ],
          teacherTips: [
            "Give pupils the formula triangle for speed, distance and time, but always require them to write the formula in words first, to avoid blind substitution errors.",
            "Use a relatable example, like running 100m at school sports day, and ask pupils to estimate reasonable times, to keep the numbers grounded in real experience.",
          ],
          transcript:
            "In our last two lessons we looked at what forces do to an object's motion. Today we look at how to describe motion numerically, by calculating speed.\n\nSpeed tells us how far an object travels in a certain amount of time. The faster something is going, the more distance it covers in the same time. We calculate speed using this equation: speed equals distance divided by time.\n\nLet's work through an example. Imagine a cyclist travels 100 metres in 20 seconds. To find her speed, we divide the distance by the time: 100 metres divided by 20 seconds equals 5. So her speed is 5 metres per second, which we write as 5 m/s. This means that, on average, she covers 5 metres every single second.\n\nIt's really important to keep the formula the right way round: distance divided by time, not time divided by distance. A quick way to check you have it right is to think about what makes sense — if a car covers 100 metres in only 10 seconds, it must be going quite fast, roughly 10 metres every second, and 100 divided by 10 does indeed give 10, confirming the formula.\n\nReal journeys rarely happen at one constant speed the whole way — think of a car that speeds up, slows down at traffic lights, and speeds up again. In cases like this we calculate average speed instead, using the total distance travelled for the whole journey divided by the total time taken for the whole journey. For example, if a runner covers a total of 400 metres in a total time of 80 seconds, even though her speed varied throughout, her average speed for the whole run is 400 divided by 80, which is 5 m/s.\n\nA common mistake is to think average speed is simply the speed at the halfway point of the journey — it isn't; it uses the total distance and total time for the entire journey, not a single moment within it. Another common mistake is mixing up the formula and dividing time by distance instead of distance by time, which gives a completely wrong answer. Let's practise calculating speed with some real examples now.",
          starterQuiz: [
            { kind: "mc", question: "Which unit would you use to measure a short distance, like the length of a classroom?", correct: ["Metres"], distractors: ["Litres", "Grams", "Degrees"] },
            { kind: "mc", question: "Which unit would you use to measure how long an activity takes?", correct: ["Seconds"], distractors: ["Metres", "Newtons", "Kilograms"] },
            { kind: "short", question: "What is 100 divided by 20?", answers: ["5"] },
          ],
          exitQuiz: [
            { kind: "mc", question: "Which equation correctly calculates speed?", correct: ["speed = distance ÷ time"], distractors: ["speed = time ÷ distance", "speed = distance × time", "speed = distance + time"] },
            { kind: "mc", question: "Which of these correctly describe average speed? (select all that apply)", correct: ["It uses the total distance divided by the total time", "It is used when speed varies during a journey"], distractors: ["It is the speed exactly halfway through a journey", "It is always the fastest speed reached"] },
            { kind: "short", question: "A car travels 150 metres in 30 seconds. What is its speed in m/s?", answers: ["5", "5 m/s"] },
            { kind: "match", question: "Match each quantity to its usual unit.", pairs: [["Distance", "Metres"], ["Time", "Seconds"], ["Speed", "Metres per second"]] },
            { kind: "order", question: "Order these steps for calculating a runner's speed: measure the distance travelled, measure the time taken, divide the distance by the time, state the speed with its unit.", items: ["measure the distance travelled", "measure the time taken", "divide the distance by the time", "state the speed with its unit"] },
          ],
          worksheet: [
            { text: "A walker covers 60 metres in 30 seconds. Calculate her speed in m/s.", type: "numeric", answer: "2" },
            { text: "A car travels 300 metres in 15 seconds. Calculate its speed in m/s.", type: "numeric", answer: "20" },
            { text: "A runner completes a 400 metre race in 80 seconds. Explain how you would calculate her average speed, and give the answer.", type: "extended" },
            { text: "Explain, using an everyday example, why a journey with lots of stops might have a low average speed even if the vehicle sometimes goes very fast.", type: "extended" },
          ],
        },
      ],
    },
  ],
};
