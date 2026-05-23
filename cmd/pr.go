package cmd

import "github.com/spf13/cobra"

var prCmd = &cobra.Command{
	Use:   "pr <command>",
	Short: "Manage pull requests",
}

func init() {
	prCmd.AddCommand(prListCmd)
	prCmd.AddCommand(prViewCmd)
	prCmd.AddCommand(prCreateCmd)
	prCmd.AddCommand(prEditCmd)
	prCmd.AddCommand(prMergeCmd)
	prCmd.AddCommand(prCloseCmd)
	prCmd.AddCommand(prReopenCmd)
	prCmd.AddCommand(prReadyCmd)
	prCmd.AddCommand(prCheckoutCmd)
	prCmd.AddCommand(prDiffCmd)
	prCmd.AddCommand(prChecksCmd)
	prCmd.AddCommand(prCommentCmd)
	prCmd.AddCommand(prReviewCmd)
	prCmd.AddCommand(prWatchCmd)
}
