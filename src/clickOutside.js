/** Dispatch event on click outside of node */
export function clickOutside(node) {
  
  const handleClick = event => {
    if (node && !node.contains(event.composedPath()[0]) && !event.defaultPrevented) {
      node.dispatchEvent(
        new CustomEvent('click_outside', node)
      )
    }
  }

	window.addEventListener('click', handleClick, true);
  
  return {
    destroy() {
      window.removeEventListener('click', handleClick, true);
    }
	}
}