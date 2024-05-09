package web

import (
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
	"strings"
	"time"

	"github.com/Masterminds/sprig/v3"
	"libdb.so/tmplutil"
)

//go:generate esbuild --bundle --format=esm --minify --sourcemap --outfile=static/hrtplotter.js static/hrtplotter/index.ts

//go:embed components pages static
var embedFS embed.FS

// Templates contains the templates for the web server.
type Templates struct {
	*tmplutil.Templater
}

// EmbeddedTemplates returns a new Templates instance with the embedded filesystem.
func EmbeddedTemplates() *Templates {
	t, err := NewTemplates(embedFS)
	if err != nil {
		panic(fmt.Errorf("failed to create embedded templates: %w", err))
	}
	return t
}

// NewTemplates returns a new templater with the given filesystem.
func NewTemplates(fs fs.FS) (*Templates, error) {
	t := &tmplutil.Templater{
		FileSystem: fs,
		Includes: map[string]string{
			"head": "components/head.html",
		},
		Functions: joinFuncMaps(
			sprig.FuncMap(),
			template.FuncMap{
				"rfc3339": func(t time.Time) string {
					return t.Format(time.RFC3339)
				},
				"storeJSON": func(name string, v any) template.HTML {
					b, err := json.Marshal(v)
					if err != nil {
						panic(fmt.Errorf("failed to marshal JSON: %w", err))
					}

					var s strings.Builder
					s.WriteString("<script async>")
					s.WriteString("window.")
					s.WriteString(name)
					s.WriteString(" = ")
					s.Write(b)
					s.WriteString(";</script>")

					return template.HTML(s.String())
				},
			},
		),
	}
	if err := t.Preregister("pages"); err != nil {
		return nil, fmt.Errorf("failed to preregister pages: %w", err)
	}
	return &Templates{t}, nil
}

func joinFuncMaps(maps ...map[string]any) map[string]any {
	out := make(map[string]any)
	for _, m := range maps {
		for k, v := range m {
			out[k] = v
		}
	}
	return out
}

// StaticHandler returns a handler for serving static files.
func (t *Templates) StaticHandler() http.Handler {
	fs_, _ := fs.Sub(t.FileSystem, "static")
	if fs_ == nil {
		panic("static files not found")
	}
	return http.StripPrefix("/static", http.FileServer(http.FS(fs_)))
}
