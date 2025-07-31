// script.js
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip");

let state = {
  selectedAirline: null,
  selectedClass: null
};

const margin = { top: 40, right: 20, bottom: 60, left: 60 };
const width = 800 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// create SVG and a <g> for chart
const svg = d3.select("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// main data load
d3.csv("data/flights.csv", d3.autoType).then(data => {
  state.data = data;
  drawOverview();
});

function clearChart() {
  svg.selectAll("*").remove();
  d3.select("#controls").html("");
}

// 1. Overview: scatter of stops vs duration, colored by airline
function drawOverview() {
  clearChart();
  const data = state.data;

  // scales
  const stops = Array.from(new Set(data.map(d => d.stops))).sort(d3.ascending);
  const x = d3.scalePoint(stops, [0, width]).padding(0.5);
  const y = d3.scaleLinear([0, d3.max(data, d => d.duration)], [height, 0]);
  const airlines = Array.from(new Set(data.map(d => d.airline)));
  const color = d3.scaleOrdinal(airlines, d3.schemeCategory10);

  // axes
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d => d));
  svg.append("g")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => d + "h"));

  svg.append("text")
  .attr("class", "axis-label")
  .attr("x", width/2)
  .attr("y", height + margin.bottom - 10)
  .attr("text-anchor", "middle")
  .text("Number of Stops");

// Y–axis label
  svg.append("text")
  .attr("class", "axis-label")
  .attr("transform", `rotate(-90)`)
  .attr("x", -height/2)
  .attr("y", -margin.left + 15)
  .attr("text-anchor", "middle")
  .text("Duration (hours)");

  // points
  // svg.selectAll("circle")
  //   .data(data)
  //   .enter().append("circle")
  //     .attr("cx", d => x(d.stops))
  //     .attr("cy", d => y(d.duration))
  //     .attr("r", 4)
  //     .attr("fill", d => color(d.airline))
  //     .attr("opacity", 0.7);

  svg.selectAll("circle")
  .data(data)
  .enter().append("circle")
    .attr("cx", d => x(d.stops))
    .attr("cy", d => y(d.duration))
    .attr("r", 4)
    .attr("fill", d => color(d.airline))
    .attr("opacity", 0.7)
  .on("mouseover", (event, d) => {
    tooltip
      .style("opacity", 1)
      .html(`
        <strong>${d.airline}</strong><br/>
        Stops: ${d.stops}<br/>
        Duration: ${d.duration}h<br/>
        From: ${d.source_city}<br/>
        To: ${d.destination_city}
      `)
      .style("left", (event.pageX + 8) + "px")
      .style("top",  (event.pageY - 28) + "px");
  })
  .on("mouseout", () => {
    tooltip.style("opacity", 0);
  });
  // legend buttons
  const controls = d3.select("#controls");
  controls.append("span").text("Drill into airline: ");
  airlines.forEach(a => {
    controls.append("button")
      .text(a)
      .on("click", () => drillAirline(a));
  });

  // annotation
  const maxStops = d3.max(data, d => d.stops);
  const longFlights = data.filter(d => d.stops === maxStops && d.duration > 10);
  if (longFlights.length) {
    const sample = longFlights[0];
    const makeAnn = d3.annotation()
      .annotations([{
        note: { title: "Long 2-stop flights", label: "Flights with 2 stops often exceed 10h" },
        x: x(sample.stops),
        y: y(sample.duration),
        dx: -80, dy: -50
      }]);
    svg.append("g")
      .attr("class", "annotation-group")
      .call(makeAnn);
  }
}

// 2. Drill into a single airline: bar chart of avg duration by destination
function drillAirline(airline) {
  state.selectedAirline = airline;
  state.selectedClass = null;
  clearChart();
  const filtered = state.data.filter(d => d.airline === airline);
  if (filtered.length === 0) {
    svg.append("text")
      .attr("x", width/2)
      .attr("y", height/2)
      .attr("text-anchor", "middle")
      .attr("fill", "#666")
      .text(`No data available for ${airline}`);
    d3.select("#controls")
      .append("button")
        .text("← Back to Overview")
        .on("click", () => {
          state.selectedAirline = null;
          drawOverview();
        });
    return;
  }
  const byDest = d3.rollups(
    filtered,
    v => d3.mean(v, d => d.duration),
    d => d.destination_city
  ).sort((a,b) => d3.descending(a[1], b[1]));

  const x = d3.scaleBand(byDest.map(d => d[0]), [0, width]).padding(0.2);
  const y = d3.scaleLinear([0, d3.max(byDest, d => d[1])], [height, 0]);

  // axes
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
      .attr("transform", "rotate(-40)")
      .style("text-anchor", "end");
  svg.append("g")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => d + "h"));

  svg.append("text")
  .attr("class", "axis-label")
  .attr("x", width/2)
  .attr("y", height + margin.bottom - 10)
  .attr("text-anchor", "middle")
  .text("Destination City");

// Y–axis label
svg.append("text")
  .attr("class", "axis-label")
  .attr("transform", `rotate(-90)`)
  .attr("x", -height/2)
  .attr("y", -margin.left + 15)
  .attr("text-anchor", "middle")
  .text("Avg. Duration (hours)");

  // bars
  svg.selectAll("rect")
    .data(byDest)
    .enter().append("rect")
      .attr("x", d => x(d[0]))
      .attr("y", d => y(d[1]))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(d[1]))
      .attr("fill", "#69b3a2");

  // annotation on top destination
  const top = byDest[0];
  const makeAnn = d3.annotation()
    .annotations([{
      note: { title: "Longest avg flight", label: `${top[0]}: ${top[1].toFixed(1)}h` },
      x: x(top[0]) + x.bandwidth()/2,
      y: y(top[1]),
      dx: 0, dy: -40
    }]);
  svg.append("g")
    .attr("class", "annotation-group")
    .call(makeAnn);

  // class buttons
  const controls = d3.select("#controls");
  controls.append("span").text(`Airline: ${airline} | Show class: `);
  ["Economy","Business"].forEach(cls => {
    controls.append("button")
      .text(cls)
      .on("click", () => drillClass(cls));
  });
}

// 3. Drill into class: histogram of durations
function drillClass(cls) {
  state.selectedClass = cls;
  clearChart();
  const filtered = state.data.filter(d =>
    d.airline === state.selectedAirline && d.class === cls
  );
  if (filtered.length === 0) {
    svg.append("text")
      .attr("x", width/2)
      .attr("y", height/2)
      .attr("text-anchor", "middle")
      .attr("fill", "#666")
      .text(`No ${cls} flights for ${state.selectedAirline}`);
    d3.select("#controls")
      .append("button")
        .text("← Back to Airline")
        .on("click", () => drillAirline(state.selectedAirline));
    return;
  }
  const durations = filtered.map(d => d.duration);
  const x = d3.scaleLinear([0, d3.max(durations)], [0, width]);
  const bins = d3.bin().thresholds(10)(durations);
  const y = d3.scaleLinear([0, d3.max(bins, d => d.length)], [height, 0]);

  // axes
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d => d + "h"));
  svg.append("g")
    .call(d3.axisLeft(y));

    svg.append("text")
  .attr("class", "axis-label")
  .attr("x", width/2)
  .attr("y", height + margin.bottom - 10)
  .attr("text-anchor", "middle")
  .text("Duration (hours)");

// Y–axis label
svg.append("text")
  .attr("class", "axis-label")
  .attr("transform", `rotate(-90)`)
  .attr("x", -height/2)
  .attr("y", -margin.left + 15)
  .attr("text-anchor", "middle")
  .text("Number of Flights");

  // bars
  svg.selectAll("rect")
    .data(bins)
    .enter().append("rect")
      .attr("x", d => x(d.x0) + 1)
      .attr("y", d => y(d.length))
      .attr("width", d => x(d.x1) - x(d.x0) - 2)
      .attr("height", d => height - y(d.length))
      .attr("fill", "#404080");

  // annotation: highest bin
  const peak = bins.reduce((a,b) => b.length > a.length ? b : a, bins[0]);
  const mid = (peak.x0 + peak.x1) / 2;
  const makeAnn = d3.annotation()
    .annotations([{
      note: { title: "Most common duration", label: `${peak.length} flights in ${peak.x0.toFixed(1)}–${peak.x1.toFixed(1)}h` },
      x: x(mid),
      y: y(peak.length),
      dx: -50, dy: -40
    }]);
  svg.append("g")
    .attr("class", "annotation-group")
    .call(makeAnn);

  // footer / back button
  d3.select("#controls")
    .append("button")
      .text("← Back to Overview")
      .on("click", () => {
        state.selectedAirline = null;
        state.selectedClass = null;
        drawOverview();
      });
}
