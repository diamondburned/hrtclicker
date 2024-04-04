package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"libdb.so/hrtclicker"
)

// UnexpectedStatusError is an error returned by the Gotify server.
type UnexpectedStatusError struct {
	Status int
	Body   string
}

func (e *UnexpectedStatusError) Error() string {
	return fmt.Sprintf("unexpected status code: %d (%s)", e.Status, e.Body)
}

// Notify sends a notification to the Gotify server.
func Notify(ctx context.Context, endpoint, token string, n hrtclicker.Notification) error {
	u := endpoint + "/message?"
	u += (url.Values{"token": {token}}).Encode()

	b, err := json.Marshal(n)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", u, bytes.NewReader(b))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	r, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send notification: %w", err)
	}
	defer r.Body.Close()

	if r.StatusCode >= 400 {
		body, _ := io.ReadAll(r.Body)
		return &UnexpectedStatusError{
			Status: r.StatusCode,
			Body:   string(body),
		}
	}

	return nil
}
