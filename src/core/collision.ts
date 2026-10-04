export function overlaps(
  firstX: number,
  firstY: number,
  firstHalfWidth: number,
  firstHalfHeight: number,
  secondX: number,
  secondY: number,
  secondHalfWidth: number,
  secondHalfHeight: number,
): boolean {
  return (
    Math.abs(firstX - secondX) <= firstHalfWidth + secondHalfWidth &&
    Math.abs(firstY - secondY) <= firstHalfHeight + secondHalfHeight
  );
}
