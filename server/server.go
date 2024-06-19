package server

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"slices"
	"time"

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
	r.Get("/dosages.json", s.getDosagesJSON)

	r.Route("/api", func(r chi.Router) {
		r.Post("/notify/test", s.handleGotifyTest)
		r.Post("/dosage/record", s.handleRecordDosage)
		r.Post("/dosage/delete", s.handleDeleteDosage)
	})

	r.Route("/static", func(r chi.Router) {
		r.Use(middleware.Compress(5))
		r.Use(middleware.SetHeader("Cache-Control", "public, must-revalidate"))
		r.Mount("/", deps.Templates.StaticHandler())
	})

	return s
}

func (s *Server) getDosagesJSON(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		write400Error(w, "failed to parse form", err)
		return
	}

	doses, err := s.Database.DosageHistory(r.Context(), string(s.Config.HRT.Type))
	if err != nil {
		writeError(w, "failed to get dosage history", err)
		return
	}

	if r.FormValue("range") != "" {
		d, err := time.ParseDuration(r.FormValue("range"))
		if err != nil {
			write400Error(w, "failed to parse range", err)
			return
		}

		after := time.Now().Add(-d)
		i := slices.IndexFunc(doses, func(dose db.HRTHistory) bool {
			return dose.DosageAt.Before(after)
		})
		if i != -1 {
			doses = doses[:i]
		}
	}

	// Reverse the order so the most recent dose is first.
	slices.Reverse(doses)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doses)
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

func write400Error(w http.ResponseWriter, msg string, err error) {
	http.Error(w, fmt.Sprintf("%s: %v", msg, err), 400)
}
