import { Command } from "commander";
import { prListCmd } from "./list.js";
import { prViewCmd } from "./view.js";
import { prCreateCmd } from "./create.js";
import { prMergeCmd } from "./merge.js";
import { prCheckoutCmd } from "./checkout.js";
import { prCloseCmd } from "./close.js";
import { prDiffCmd } from "./diff.js";
import { prCommentCmd } from "./comment.js";
import { prReviewCmd } from "./review.js";
import { prWatchCmd } from "./watch.js";

export const prCmd = new Command("pr")
  .description("Manage pull requests")
  .addCommand(prListCmd)
  .addCommand(prViewCmd)
  .addCommand(prCreateCmd)
  .addCommand(prMergeCmd)
  .addCommand(prCheckoutCmd)
  .addCommand(prCloseCmd)
  .addCommand(prDiffCmd)
  .addCommand(prCommentCmd)
  .addCommand(prReviewCmd)
  .addCommand(prWatchCmd);
