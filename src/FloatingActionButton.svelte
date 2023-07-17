<svelte:options tag="vis-fab" />

<script>
  import { get_current_component } from 'svelte/internal'
  const component = get_current_component()

	export let height = '50px'
	export let width = '50px'
	export let fabcolor = '#000000'
	export let background = '#FFFFFF'
  // export let contextbg = '#FFFFFF'
	export let position = 'bottom right'
	export let borderradius = '100%'
	export let opened = false

	const positiony = position.split(' ')[0] === 'top' ? 'initial': '0'
	const positionx = position.split(' ')[1] === 'left' ? 'initial': '0'

	export function open () {
		opened = true
    component?.dispatchEvent(new CustomEvent('open', { detail: null, composed: true }))
	}

	export function close () {
		opened = false
		component?.dispatchEvent(new CustomEvent('close', { detail: null, composed: true }))
	}

	export function toggle () {
		opened ? close() : open()
    component?.dispatchEvent(new CustomEvent('toggle', { detail: null, composed: true }))
	}
</script>

<main>
	<div class="vis-fab-wrapper"
  style="--height: {height}; --width: {width}; --fabcolor: {fabcolor}; --background: {background}; --borderradius: {borderradius}; --positiony: {positiony}; --positionx: {positionx}">
    <input type="checkbox" />
    <div class="vis-fab"></div>
    <div class="vis-fab-context">
      <slot></slot>
    </div>
  </div>  
</main>

<style>
	.vis-fab-wrapper {
    width: var(--width, 50px);
    height: var(--height, 50px);
    position: relative;
    border-radius: var(--border-radius, 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 16px;
    position: fixed;
    bottom: var(--positiony);
    right: var(--positionx);
    z-index: 999;
  }
  
  .vis-fab-wrapper .vis-fab {
    background: var(--background, #4285f4);
    width: var(--width, 50px);
    height: var(--height, 50px);
    position: relative;
    z-index: 3;
    border-radius: var(--borderradius, 100%);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    animation: vis-fab-animation-reverse 0.4s ease-out forwards;
  }

  .vis-fab-wrapper .vis-fab::before,
  .vis-fab-wrapper .vis-fab::after {
    content: "";
    display: block;
    position: absolute;
    border-radius: 4px;
    background: var(--fabcolor, #FFFFFF);
  }
  
  .vis-fab-wrapper .vis-fab::before {
    width: 4px;
    height: 18px;
  }
  
  .vis-fab-wrapper .vis-fab::after {
    width: 18px;
    height: 4px;
  }
  
  .vis-fab-wrapper .vis-fab-context {
    width: 32px;
    height: 150px;
    border-radius: 64px;
    position: absolute;
    background: #fff;
    z-index: 2;
    padding: 0.5rem 0.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    opacity: 0;
    top: -110px;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    transition: opacity 0.2s ease-in, top 0.2s ease-in, width 0.1s ease-in;
  }
  
  .vis-fab-wrapper .vis-fab-context a {
    color: var(--fabcolor, #344955);
    opacity: 0.8;
  }

  .vis-fab-wrapper .vis-fab-context a:hover {
    transition: 0.2s;
    opacity: 1;
    color: darken(#344955, 2%);
  }

  .vis-fab-wrapper .vis-fab-context .t-Button {
    --a-button-padding-x: 0 !important;
  }
  
  .vis-fab-wrapper input {
    height: 100%;
    width: 100%;
    border-radius: var(--borderradius);
    cursor: pointer;
    position: absolute;
    z-index: 5;
    opacity: 0;
  }

  .vis-fab-wrapper input:checked ~ .vis-fab {
    animation: vis-fab-animation 0.4s ease-out forwards;
  }
      
  .vis-fab-wrapper input:checked ~ .vis-fab-context {
    width: 32px;
    height: 150px;
    animation: vis-fac-animation 0.4s ease-out forwards 0.1s;
    top: -180px;
    opacity: 1;
  }

  @keyframes vis-fab-animation {
    0% {
      transform: rotate(0) scale(1);
    }
    20% {
      transform: rotate(60deg) scale(0.93);
    }
    55% {
      transform: rotate(35deg) scale(0.97);
    }
    80% {
      transform: rotate(48deg) scale(0.94);
    }
    100% {
      transform: rotate(45deg) scale(0.95);
    }
  }

  @keyframes vis-fab-animation-reverse {
    0% {
      transform: rotate(45deg) scale(0.95);
    }
    20% {
      transform: rotate(-15deg);
    }
    55% {
      transform: rotate(10deg);
    }
    80% {
      transform: rotate(-3deg);
    }
    100% {
      transform: rotate(0) scale(1);
    }
  }

  @keyframes vis-fac-animation {
    0% {
      transform: scale(1, 1);
    }
    33% {
      transform: scale(0.95, 1.05);
    }
    66% {
      transform: scale(1.05, 0.95);
    }
    100% {
      transform: scale(1, 1);
    }
  }
</style>