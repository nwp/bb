import { Command } from "commander";
import { prListCmd } from "./list.js";
import { prViewCmd } from "./view.js";
import { prCreateCmd } from "./create.js";
import { prEditCmd } from "./edit.js";
import { prMergeCmd } from "./merge.js";
import { prCheckoutCmd } from "./checkout.js";
import { prCloseCmd } from "./close.js";
import { prReopenCmd } from "./reopen.js";
import { prReadyCmd } from "./ready.js";
import { prDiffCmd } from "./diff.js";
import { prChecksCmd } from "./checks.js";
import { prCommentCmd } from "./comment.js";
import { prReviewCmd } from "./review.js";
import { prWatchCmd } from "./watch.js";

export const prCmd = new Command("pr")
  .description("Manage pull requests")
  .addCommand(prListCmd)
  .addCommand(prViewCmd)
  .addCommand(prCreateCmd)
  .addCommand(prEditCmd)
  .addCommand(prMergeCmd)
  .addCommand(prCheckoutCmd)
  .addCommand(prCloseCmd)
  .addCommand(prReopenCmd)
  .addCommand(prReadyCmd)
  .addCommand(prDiffCmd)
  .addCommand(prChecksCmd)
  .addCommand(prCommentCmd)
  .addCommand(prReviewCmd)
  .addCommand(prWatchCmd);
