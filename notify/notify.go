package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"text/template"
	"time"

	"libdb.so/hrtclicker"
	"libdb.so/hrtclicker/db"
)

// Dependencies is a set of dependencies required by the Monitor.
type Dependencies struct {
	Config   *hrtclicker.Config
	Logger   *slog.Logger
	Database *db.SQLiteDB
}

// Monitor is responsible for monitoring the HRT clicker application.
// It monitors for the next dosage time and sends notifications to the user via
// the gotify service configured in the dependency configuration.
type Monitor struct {
	Dependencies
	titleTmpl   *template.Template
	messageTmpl *template.Template
}

func NewMonitor(deps Dependencies) *Monitor {
	return &Monitor{Dependencies: deps}
}

const tickInterval = time.Second

// Run starts the monitoring process for the HRT clicker application until the
// context is canceled.
func (m *Monitor) Run(ctx context.Context) (err error) {
	m.titleTmpl, err = template.New("title").Parse(m.Config.Gotify.Notification.Title)
	if err != nil {
		return fmt.Errorf("failed to parse title template: %w", err)
	}

	m.messageTmpl, err = template.New("message").Parse(m.Config.Gotify.Notification.Message)
	if err != nil {
		return fmt.Errorf("failed to parse message template: %w", err)
	}

	// TODO: make this more optimized
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case now := <-ticker.C:
			lastDose, err := m.Database.LastDose(ctx, string(m.Config.HRT.Type))
			if err != nil {
				m.Logger.Error(
					"failed to get last dose",
					"err", err)
				continue
			}

			nextDose := lastDose.DosageAt.Add(time.Duration(m.Config.HRT.Interval))
			if now.Before(nextDose) {
				continue
			}

			m.Logger.Debug(
				"sending gotify notification",
				"endpoint", m.Config.Gotify.Endpoint)

			m.sendNotification(ctx, hrtclicker.NotificationTemplateData{
				LastDoseAt: lastDose.DosageAt,
				NextDoseAt: nextDose,
				HRTType:    m.Config.HRT.Type,
			})
		}
	}
}

func (m *Monitor) sendNotification(ctx context.Context, data hrtclicker.NotificationTemplateData) {
	title, err := renderStringTemplate(m.titleTmpl, data)
	if err != nil {
		m.Logger.Error(
			"failed to render title template",
			"data", data,
			"err", err)
		return
	}

	message, err := renderStringTemplate(m.messageTmpl, data)
	if err != nil {
		m.Logger.Error(
			"failed to render message template",
			"data", data,
			"err", err)
		return
	}

	notification := hrtclicker.Notification{
		Title:   title,
		Message: message,
		Extras:  m.Config.Gotify.Notification.Extras,
	}

	u := m.Config.Gotify.Endpoint + "/message?"
	u += (url.Values{"token": {m.Config.Gotify.Token}}).Encode()

	b, err := json.Marshal(notification)
	if err != nil {
		m.Logger.Error(
			"failed to marshal notification",
			"notification", notification,
			"err", err)
		return
	}

	req, err := http.NewRequestWithContext(ctx, "POST", u, bytes.NewReader(b))
	if err != nil {
		m.Logger.Error(
			"failed to create request",
			"method", "POST",
			"endpoint", m.Config.Gotify.Endpoint,
			"err", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	r, err := http.DefaultClient.Do(req)
	if err != nil {
		m.Logger.Error(
			"failed to send notification",
			"method", "POST",
			"endpoint", m.Config.Gotify.Endpoint,
			"err", err)
		return
	}
	defer r.Body.Close()

	if r.StatusCode >= 400 {
		body, _ := io.ReadAll(r.Body)
		m.Logger.Error(
			"unexpected status code",
			"method", "POST",
			"endpoint", m.Config.Gotify.Endpoint,
			"status_code", r.StatusCode,
			"body", string(body))
		return
	}
}

func renderStringTemplate(tmpl *template.Template, data any) (string, error) {
	var s strings.Builder
	err := tmpl.Execute(&s, data)
	return s.String(), err
}
