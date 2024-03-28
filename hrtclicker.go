package hrtclicker

import "time"

// HRTType contains the enumeration for the various types of hormone replacement
// therapy. The supported types are listed as constants.
type HRTType string

const (
	TypePatches    HRTType = "patches"
	TypeGel        HRTType = "gel"
	TypeSublingual HRTType = "sublingual"
	TypeInjection  HRTType = "injection"
)

// Notification is a type used to represent the notification message.
// It copies Gotify's notification message format.
type Notification struct {
	Title   string         `json:"title"`
	Message string         `json:"message"`
	Extras  map[string]any `json:"extras"`
}

// NotificationTemplateData is the data used for rendering the template of both
// the notification title and message.
type NotificationTemplateData struct {
	LastDoseAt time.Time
	NextDoseAt time.Time
	HRTType    HRTType
}
