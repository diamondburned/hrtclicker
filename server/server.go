package server

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"libdb.so/hrtclicker"
	"libdb.so/hrtclicker/db"
	"libdb.so/hrtclicker/internal/notifier"
	"libdb.so/hrtclicker/web"
)

type Dependencies struct {
	Logger    *slog.Logger
	Database  *db.SQLiteDB
	Config    *hrtclicker.Config
	Templates *web.Templates
}

type Server struct {
	http.Handler
	Dependencies
}

func New(deps Dependencies) *Server {
	r := chi.NewRouter()
	s := &Server{
		Handler:      r,
		Dependencies: deps,
	}

	r.Get("/", s.handleIndex)
	r.Post("/notify/test", s.handleGotifyTest)
	r.Post("/dosage/record", s.handleRecordDosage)
	r.Post("/dosage/delete", s.handleDeleteDosage)

	r.Route("/static", func(r chi.Router) {
		r.Use(middleware.Compress(5))
		r.Use(middleware.SetHeader("Cache-Control", "public, must-revalidate"))
		r.Mount("/", deps.Templates.StaticHandler())
	})

	return s
}

func (s *Server) handleRecordDosage(w http.ResponseWriter, r *http.Request) {
	if err := s.Database.RecordDosage(r.Context(), string(s.Config.HRT.Type)); err != nil {
		writeError(w, "failed to record dosage", err)
		return
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (s *Server) handleDeleteDosage(w http.ResponseWriter, r *http.Request) {
	if err := s.Database.DeleteLastDose(r.Context(), string(s.Config.HRT.Type)); err != nil {
		writeError(w, "failed to delete dosage", err)
		return
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (s *Server) handleGotifyTest(w http.ResponseWriter, r *http.Request) {
	notification := hrtclicker.Notification{
		Title:   "Test Notification",
		Message: "hi cutie! <3",
		Extras:  s.Config.Gotify.Notification.Extras,
	}

	if err := notifier.Notify(
		r.Context(),
		s.Config.Gotify.Endpoint,
		s.Config.Gotify.Token,
		notification,
	); err != nil {
		writeError(w, "failed to send test notification", err)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	io.WriteString(w, "notification sent, go check your phone!")
}

func writeError(w http.ResponseWriter, msg string, err error) {
	http.Error(w, fmt.Sprintf("%s: %v", msg, err), http.StatusInternalServerError)
}
