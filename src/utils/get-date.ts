export default function (diff = 0): string {
	const now = new Date();
	now.setDate(now.getDate() + diff);
	const y = now.getFullYear();
	const m = now.getMonth();
	const d = now.getDate();
	const today = `${y}/${m + 1}/${d}`;
	return today;
}
