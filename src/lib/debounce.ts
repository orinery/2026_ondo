/**
 * 마지막 호출 후 delay(ms) 동안 추가 호출이 없을 때만 fn을 실행한다.
 *
 * 출처: ive/html/js/totosys/iveLib.js:12029 `debounce(func, delay = 200)`
 * 개선점:
 * - 제네릭으로 인자 타입을 보존한다 (any 없음).
 * - cancel()을 추가했다. React 컴포넌트가 언마운트될 때 대기 중인 호출을 취소해
 *   언마운트 이후 상태 업데이트가 일어나지 않게 하기 위해서다.
 */
export type Debounced<Args extends unknown[]> = ((...args: Args) => void) & { cancel: () => void };

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay = 200,
): Debounced<Args> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timeoutId);

  return debounced;
}
