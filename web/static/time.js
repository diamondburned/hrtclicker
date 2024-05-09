const relativeFormatters = {
  short: new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" }),
  long: new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "long" }),
};

function formatDuration(duration, long = false) {
  duration = duration / 1000;

  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;

  let unit = "second";
  if (Math.abs(duration) > day) {
    unit = "day";
    duration = Math.round(duration / day);
  } else if (Math.abs(duration) > hour) {
    unit = "hour";
    duration = Math.round(duration / hour);
  } else if (Math.abs(duration) > minute) {
    unit = "minute";
    duration = Math.round(duration / minute);
  } else {
    duration = Math.round(duration);
  }

  return relativeFormatters[long ? "long" : "short"].format(duration, unit);
}

const absoluteFormatters = {
  short: new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "numeric",
  }),
  long: new Intl.DateTimeFormat("en", {
    timeStyle: "medium",
    dateStyle: "medium",
  }),
};

function formatTime(time, long = false) {
  return absoluteFormatters[long ? "long" : "short"].format(time);
}

document.querySelectorAll("time").forEach((el) => {
  const time = Date.parse(el.getAttribute("datetime"));
  const long = el.getAttribute("data-format") == "long";
  // const title = !!el.getAttribute("data-format-title");
  const format = el.classList.contains("relative")
    ? () => formatDuration(time - Date.now(), long)
    : () => formatTime(time, long);
  const update = () => {
    el.textContent = format();
  };
  setInterval(update, 1000);
  update();
});

document.querySelectorAll("button[data-destructive]").forEach((el) => {
  const confirmation = el.getAttribute("data-confirmation") || "Are you sure?";
  el.addEventListener("click", (e) => {
    if (!confirm(confirmation)) {
      e.preventDefault();
    }
  });
});
