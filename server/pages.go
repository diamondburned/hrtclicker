package server

import (
	"context"
	"net/http"
	"time"

	"libdb.so/hrtclicker"
	"libdb.so/hrtclicker/db"
)

type indexData struct {
	HRTType hrtclicker.HRTType
	deps    Dependencies
	ctx     context.Context
}

func (d indexData) NextDoseTime() (time.Time, error) {
	s := d.deps

	dose, err := s.Database.LastDose(d.ctx, string(s.Config.HRT.Type))
	if err != nil {
		if db.IsNotFound(err) {
			return time.Time{}, nil
		}
		return time.Time{}, err
	}

	return dose.DosageAt.Add(time.Duration(s.Config.HRT.Interval)), nil
}

func (d indexData) DosageHistory() ([]db.HRTHistory, error) {
	return d.deps.Database.DosageHistory(d.ctx, string(d.deps.Config.HRT.Type))
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	s.Templates.Execute(w, "index", indexData{
		HRTType: s.Config.HRT.Type,
		deps:    s.Dependencies,
		ctx:     r.Context(),
	})
}
