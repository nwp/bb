// Package format provides terminal output helpers: relative dates, ANSI colors,
// string truncation, and aligned table printing.
package format

import (
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/fatih/color"
)

// Fatal prints msg to stderr and exits with code 1.
func Fatal(msg string) {
	fmt.Fprintln(os.Stderr, msg)
	os.Exit(1)
}

// Fatalf formats and prints to stderr, then exits with code 1.
func Fatalf(format string, a ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", a...)
	os.Exit(1)
}

// FormatDate converts a millisecond Unix timestamp to a human-readable relative
// or absolute date string.
func FormatDate(ms int64) string {
	t := time.UnixMilli(ms)
	diff := time.Since(t)

	switch {
	case diff < 10*time.Second:
		return "just now"
	case diff < time.Hour:
		return fmt.Sprintf("%dm ago", int(diff.Minutes()))
	case diff < 24*time.Hour:
		return fmt.Sprintf("%dh ago", int(diff.Hours()))
	case diff < 30*24*time.Hour:
		return fmt.Sprintf("%dd ago", int(diff.Hours()/24))
	default:
		return t.Format("Jan 2, 2006")
	}
}

// StateColor wraps state strings in ANSI color codes appropriate to their meaning.
func StateColor(state string) string {
	switch strings.ToUpper(state) {
	case "OPEN", "APPROVED":
		return color.GreenString(state)
	case "MERGED":
		return color.MagentaString(state)
	case "DECLINED", "CLOSED", "NEEDS_WORK":
		return color.RedString(state)
	case "UNAPPROVED":
		return color.YellowString(state)
	default:
		return state
	}
}

// Truncate clips s to at most max visible characters, appending an ellipsis if
// the string was shortened. Uses rune-aware length.
func Truncate(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	runes := []rune(s)
	return string(runes[:max-1]) + "…"
}

var ansiEscape = regexp.MustCompile(`\x1B\[[0-?]*[ -/]*[@-~]`)

// StripAnsi removes ANSI escape sequences from s.
func StripAnsi(s string) string {
	return ansiEscape.ReplaceAllString(s, "")
}

// PrintTable prints rows as a left-aligned table to w. All columns except the
// last are padded to the maximum visible width in that column. Columns are
// separated by two spaces.
func PrintTable(w io.Writer, rows [][]string) {
	if len(rows) == 0 {
		return
	}
	// Compute max visible width per column.
	cols := len(rows[0])
	widths := make([]int, cols)
	for _, row := range rows {
		for c, cell := range row {
			if c >= cols {
				break
			}
			vw := utf8.RuneCountInString(StripAnsi(cell))
			if vw > widths[c] {
				widths[c] = vw
			}
		}
	}
	for _, row := range rows {
		var sb strings.Builder
		for c, cell := range row {
			if c > 0 {
				sb.WriteString("  ")
			}
			sb.WriteString(cell)
			// Pad all but the last column.
			if c < len(row)-1 {
				visible := utf8.RuneCountInString(StripAnsi(cell))
				sb.WriteString(strings.Repeat(" ", widths[c]-visible))
			}
		}
		fmt.Fprintln(w, sb.String())
	}
}
