package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/nwp/bb/internal/cache"
	"github.com/nwp/bb/internal/format"
	"github.com/spf13/cobra"
)

var cacheListCmd = &cobra.Command{
	Use:   "list",
	Short: "List cached repository context entries",
	RunE:  runCacheList,
}

var cacheListJSON bool

func init() {
	cacheListCmd.Flags().BoolVar(&cacheListJSON, "json", false, "Output as JSON")
}

func runCacheList(cmd *cobra.Command, _ []string) error {
	c := cache.Default()
	entries, err := c.List()
	if err != nil {
		return err
	}

	if cacheListJSON {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(entries)
	}

	if len(entries) == 0 {
		fmt.Fprintln(cmd.OutOrStdout(), "Cache is empty")
		return nil
	}

	var rows [][]string
	for _, e := range entries {
		timeStr := e.CachedAt
		if t, err := time.Parse(time.RFC3339Nano, e.CachedAt); err == nil {
			timeStr = format.FormatDate(t.UnixMilli())
		}
		rows = append(rows, []string{
			format.Truncate(e.Dir, 60),
			e.Hostname,
			e.Project + "/" + e.Repo,
			timeStr,
		})
	}
	format.PrintTable(cmd.OutOrStdout(), rows)
	return nil
}

var cacheDeleteCmd = &cobra.Command{
	Use:   "delete [dir]",
	Short: "Delete a cached repository context entry",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runCacheDelete,
}

func runCacheDelete(cmd *cobra.Command, args []string) error {
	target := ""
	if len(args) > 0 {
		target = args[0]
	} else {
		var err error
		target, err = os.Getwd()
		if err != nil {
			return fmt.Errorf("getting working directory: %w", err)
		}
	}

	c := cache.Default()
	existed, err := c.Delete(target)
	if err != nil {
		return err
	}
	if existed {
		fmt.Fprintf(cmd.OutOrStdout(), "Deleted cache entry for %s\n", target)
	} else {
		fmt.Fprintf(cmd.OutOrStdout(), "No cache entry found for %s\n", target)
	}
	return nil
}
