import { createCanvas, registerFont } from 'canvas';

const width = 1024 + 256;
const height = 512 + 256;
const margin = 128;
const titleTextSize = 35;

const lineWidth = 16;
const yAxisThickness = 2;

const colors = {
	bg: '#434343',
	text: '#e0e4cc',
	yAxis: '#5a5a5a',
	dataset: [
		'#ff4e50',
		'#c2f725',
		'#69d2e7',
		'#f38630',
		'#f9d423',
	]
};

const yAxisTicks = 4;

type Chart = {
	title?: string;
	datasets: {
		title?: string;
		data: number[];
	}[];
};

export function renderChart(chart: Chart) {
	registerFont('./font.ttf', { family: 'CustomFont' });

	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');
	ctx.antialias = 'default';

	ctx.fillStyle = colors.bg;
	ctx.beginPath();
	ctx.fillRect(0, 0, width, height);

	let chartAreaX = margin;
	let chartAreaY = margin;
	let chartAreaWidth = width - (margin * 2);
	let chartAreaHeight = height - (margin * 2);

	// Draw title
	if (chart.title) {
		ctx.font = `${titleTextSize}px CustomFont`;
		const t = ctx.measureText(chart.title);
		ctx.fillStyle = colors.text;
		ctx.fillText(chart.title, (width / 2) - (t.width / 2), 128);

		chartAreaY += titleTextSize;
		chartAreaHeight -= titleTextSize;
	}

	const xAxisCount = chart.datasets[0].data.length;
	const serieses = chart.datasets.length;
	const totals = Array.from({ length: xAxisCount }, (_, xAxis) => {
		let total = 0;
		for (let series = 0; series < serieses; series++) {
			total += chart.datasets[series].data[xAxis];
		}
		return total;
	});

	let lowerBound = Infinity;
	let upperBound = -Infinity;

	for (const total of totals) {
		if (total > upperBound) upperBound = total;
		if (total < lowerBound) lowerBound = total;
	}
	lowerBound = Math.min(0, lowerBound);

	// Calculate Y axis scale
	const yAxisSteps = niceScale(lowerBound, upperBound, yAxisTicks);
	const yAxisStepsMin = yAxisSteps[0];
	const yAxisStepsMax = yAxisSteps[yAxisSteps.length - 1];
	const yAxisRange = yAxisStepsMax - yAxisStepsMin;
	const yAxisStepSize = yAxisSteps.length > 1 ? yAxisSteps[1] - yAxisSteps[0] : 0;

	// Draw Y axis
	ctx.lineWidth = yAxisThickness;
	ctx.lineCap = 'round';
	ctx.strokeStyle = colors.yAxis;
	for (let i = 0; i < yAxisSteps.length; i++) {
		const step = yAxisSteps[yAxisSteps.length - i - 1];
		const y = i * (chartAreaHeight / (yAxisSteps.length - 1));
		ctx.beginPath();
		ctx.lineTo(chartAreaX, chartAreaY + y);
		ctx.lineTo(chartAreaX + chartAreaWidth, chartAreaY + y);
		ctx.stroke();

		ctx.font = '20px CustomFont';
		ctx.fillStyle = colors.text;
		ctx.fillText(formatAxisLabel(step, yAxisStepSize), chartAreaX, chartAreaY + y - 8);
	}

	const perXAxisWidth = chartAreaWidth / xAxisCount;
	const yScale = yAxisRange === 0 ? 0 : chartAreaHeight / yAxisRange;

	// Draw X axis
	ctx.lineWidth = lineWidth;
	ctx.lineCap = 'round';

	for (let xAxis = 0; xAxis < xAxisCount; xAxis++) {
		const xAxisPerTypeHeights: number[] = chart.datasets.map(({ data }) => data[xAxis] * yScale);

		for (let series = serieses - 1; series >= 0; series--) {
			ctx.strokeStyle = colors.dataset[series % colors.dataset.length];

			let total = 0;
			for (let i = 0; i < series; i++) {
				total += xAxisPerTypeHeights[i];
			}

			const height = xAxisPerTypeHeights[series];

			const x = chartAreaX + (perXAxisWidth * ((xAxisCount - 1) - xAxis)) + (perXAxisWidth / 2);

			const yTop = (chartAreaY + chartAreaHeight) - (total + height);
			const yBottom = (chartAreaY + chartAreaHeight) - (total);

			ctx.globalAlpha = 1 - (xAxis / xAxisCount);
			ctx.beginPath();
			ctx.lineTo(x, yTop);
			ctx.lineTo(x, yBottom);
			ctx.stroke();
		}
	}

	return canvas.toBuffer();
}

// https://stackoverflow.com/questions/326679/choosing-an-attractive-linear-scale-for-a-graphs-y-axis
// https://github.com/apexcharts/apexcharts.js/blob/master/src/modules/Scales.js
// This routine creates the Y axis values for a graph.
function niceScale(lowerBound: number, upperBound: number, ticks: number): number[] {
	if (lowerBound === 0 && upperBound === 0) return [0];
	if (lowerBound === upperBound) {
		const padding = Math.abs(lowerBound || 1) * 0.1;
		lowerBound -= padding;
		upperBound += padding;
	}

	// Calculate Min amd Max graphical labels and graph
	// increments.  The number of ticks defaults to
	// 10 which is the SUGGESTED value.  Any tick value
	// entered is used as a suggested value which is
	// adjusted to be a 'pretty' value.
	//
	// Output will be an array of the Y axis values that
	// encompass the Y values.
	const steps: number[] = [];

	// Determine Range
	const range = upperBound - lowerBound;

	let tiks = ticks + 1;
	// Adjust ticks if needed
	if (tiks < 2) {
		tiks = 2;
	} else if (tiks > 2) {
		tiks -= 2;
	}

	// Get raw step value
	const tempStep = range / tiks;

	// Calculate pretty step value
	const stepSize = niceNum(tempStep);

	// build Y label array.
	// Lower and upper bounds calculations
	const lb = stepSize * Math.floor(lowerBound / stepSize);
	const ub = stepSize * Math.ceil(upperBound / stepSize);
	// Build array
	let val = lb;
	const decimals = decimalPlaces(stepSize);
	while (1) {
		steps.push(roundTo(val, decimals));
		val += stepSize;
		if (val > ub) {
			break;
		}
	}

	return steps;
}

function niceNum(value: number): number {
	const exponent = Math.floor(Math.log10(value));
	const fraction = value / Math.pow(10, exponent);

	let niceFraction;
	if (fraction <= 1) {
		niceFraction = 1;
	} else if (fraction <= 2) {
		niceFraction = 2;
	} else if (fraction <= 5) {
		niceFraction = 5;
	} else {
		niceFraction = 10;
	}

	return niceFraction * Math.pow(10, exponent);
}

function decimalPlaces(value: number): number {
	if (!Number.isFinite(value) || value === 0) return 0;
	const exponent = Math.floor(Math.log10(Math.abs(value)));
	return Math.max(0, -exponent + 2);
}

function roundTo(value: number, decimals: number): number {
	const factor = Math.pow(10, decimals);
	return Math.round(value * factor) / factor;
}

function formatAxisLabel(value: number, stepSize: number): string {
	const decimals = decimalPlaces(stepSize);
	const rounded = roundTo(value, decimals);
	if (Number.isInteger(rounded)) {
		return rounded.toString();
	}
	return rounded.toFixed(Math.min(decimals, 6)).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}
