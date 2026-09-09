"use client";

import { MultipleChoice } from "./MultipleChoice";
import { MultiSelect } from "./MultiSelect";
import { TrueFalse } from "./TrueFalse";
import { ShortAnswer } from "./ShortAnswer";
import { ExtendedText } from "./ExtendedText";
import { Numeric } from "./Numeric";
import { Matching } from "./Matching";
import { Ordering } from "./Ordering";
import { QuestionImage } from "./QuestionImage";
import { imageSchema } from "@/lib/questions/types";
import type { QuestionRendererProps } from "./types";

export type { QuestionRendererProps, QuestionResult, StudentQuestionLite, Option } from "./types";

/** Switches on `question.type` to the right per-type renderer. */
export function QuestionRenderer(props: QuestionRendererProps) {
  // Validated rather than trusted: this comes from a provider's JSON, and a malformed image is
  // not a reason to take the whole question off the screen.
  const image = imageSchema.safeParse(props.question.promptImage);

  return (
    <>
      {image.success ? <QuestionImage image={image.data} /> : null}
      <QuestionBody {...props} />
    </>
  );
}

function QuestionBody(props: QuestionRendererProps) {
  switch (props.question.type) {
    case "MULTIPLE_CHOICE":
      return <MultipleChoice {...props} />;
    case "MULTI_SELECT":
      return <MultiSelect {...props} />;
    case "TRUE_FALSE":
      return <TrueFalse {...props} />;
    case "SHORT_ANSWER":
      return <ShortAnswer {...props} />;
    case "EXTENDED_TEXT":
      return <ExtendedText {...props} />;
    case "NUMERIC":
      return <Numeric {...props} />;
    case "MATCHING":
      return <Matching {...props} />;
    case "ORDERING":
      return <Ordering {...props} />;
    default:
      return <p className="text-sm text-danger">Unsupported question type: {props.question.type}</p>;
  }
}
