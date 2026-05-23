package format_test

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/nwp/bb/internal/format"
	"github.com/stretchr/testify/assert"
)

func TestFormatDate(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name string
		ms   int64
		want string
	}{
		{"just now", now.Add(-5 * time.Second).UnixMilli(), "just now"},
		{"minutes", now.Add(-5 * time.Minute).UnixMilli(), "5m ago"},
		{"hours", now.Add(-3 * time.Hour).UnixMilli(), "3h ago"},
		{"days", now.Add(-7 * 24 * time.Hour).UnixMilli(), "7d ago"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, format.FormatDate(tt.ms))
		})
	}
}

func TestFormatDateAbsolute(t *testing.T) {
	// More than 30 days ago should return an absolute date, not relative.
	old := time.Now().Add(-60 * 24 * time.Hour)
	result := format.FormatDate(old.UnixMilli())
	// Should not contain "ago" or "just now".
	assert.NotContains(t, result, "ago")
	assert.NotContains(t, result, "just now")
	// Should look like a date string.
	assert.True(t, len(result) > 4)
}

func TestStateColor(t *testing.T) {
	// State is returned (possibly with ANSI codes) — just check it contains the state.
	for _, state := range []string{"OPEN", "MERGED", "DECLINED", "UNAPPROVED", "APPROVED"} {
		got := format.StateColor(state)
		assert.Contains(t, format.StripAnsi(got), state)
	}
	// Unknown state is returned as-is.
	assert.Equal(t, "PENDING", format.StateColor("PENDING"))
	// Case-insensitive.
	got := format.StateColor("open")
	assert.Contains(t, format.StripAnsi(got), "open")
}

func TestTruncate(t *testing.T) {
	tests := []struct {
		s    string
		max  int
		want string
	}{
		{"hello", 10, "hello"},
		{"hello", 5, "hello"},
		{"hello world", 8, "hello w…"},
		{"", 5, ""},
		{"a", 1, "a"},
		{"ab", 1, "…"},
	}
	for _, tt := range tests {
		got := format.Truncate(tt.s, tt.max)
		assert.Equal(t, tt.want, got, "Truncate(%q, %d)", tt.s, tt.max)
	}
}

func TestStripAnsi(t *testing.T) {
	assert.Equal(t, "hello", format.StripAnsi("\x1B[32mhello\x1B[0m"))
	assert.Equal(t, "plain", format.StripAnsi("plain"))
}

func TestPrintTable(t *testing.T) {
	var buf bytes.Buffer
	rows := [][]string{
		{"foo", "bar", "baz"},
		{"longer", "b", "c"},
	}
	format.PrintTable(&buf, rows)
	lines := strings.Split(strings.TrimRight(buf.String(), "\n"), "\n")
	assert.Len(t, lines, 2)
	// First column should be padded to len("longer") = 6 in first row.
	assert.True(t, strings.HasPrefix(lines[0], "foo   "), "expected padding, got %q", lines[0])
	// Last column not padded.
	assert.True(t, strings.HasSuffix(lines[0], "baz"))
}

func TestPrintTableEmpty(t *testing.T) {
	var buf bytes.Buffer
	format.PrintTable(&buf, nil)
	assert.Empty(t, buf.String())
}
