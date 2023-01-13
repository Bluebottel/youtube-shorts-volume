// ==UserScript==
// @name         Youtube shorts volume control
// @version      1.0
// @grant        GM_addStyle
// @match        *www.youtube.com*
// @match        *www.youtube.com/shorts*
// ==/UserScript==

const LOCALSTORAGE_VOLUME = 'shortsPlayerVolume'
const DEFAULT_VOLUME = '0.05'
const VOLUME_FUNCTION = 'exponential' // 'linear'

'use strict'
const state = {
  shortsPlayer: undefined,
  video: undefined,
  innerContainer: undefined,
  rawVolume: window.localStorage.getItem(LOCALSTORAGE_VOLUME) ?? DEFAULT_VOLUME,
  sliders: [],
  idTicker: 0,
}

// the elements stay cached so only add observers + initial sliders once
let fuse = false

if (!fuse && document.URL.match(/.*\/shorts\/.*/)) {
  fuse = true
  main()
}
else {
  const menuObserver = new MutationObserver(() => {
    if (!fuse && document.URL.match(/.*\/shorts\/.*/)) {
      fuse = true
      main()
    }
  })
  menuObserver.observe(document.body, { attributes: true })
}

async function main() {

  // wait for the video player to load
  await waitUntilSuccess(() => {
    state.shortsPlayer = document.getElementById('shorts-player')
    state.innerContainer = document.getElementById('shorts-inner-container')
    if (!state.shortsPlayer || !state.innerContainer) return false
    state.video = state.shortsPlayer.querySelector('video')

    return true
  })

  const videoObserver = new MutationObserver(() => state.video.volume = transformVolume(state.rawVolume))

  // triggers whenever a new video is switched to
  videoObserver.observe(state.video, { attributes: true })

  const actionsBars = state.innerContainer.querySelectorAll('#actions')

  // add volume sliders to all currently loaded videos
  for (let actionsBar of actionsBars) {
    const { slider, wrappedSlider } = createRangeSlider(state.rawVolume, onChangeVolume)
    state.sliders.push({ element: actionsBar, slider })
    actionsBar.prepend(wrappedSlider)
  }

  // more videos get loaded after scrolling
  const innerMutation = new MutationObserver(() => {
    const allActionBars = state.innerContainer.querySelectorAll('#actions')
    allActionBars.forEach(actionsBar => {
      // already added
      if (state.sliders.some(({ element }) => element === actionsBar)) return

      const { slider, wrappedSlider } = createRangeSlider(state.rawVolume, onChangeVolume)
      state.sliders.push({ element: actionsBar, slider })
      actionsBar.prepend(wrappedSlider)
    })
  })
  innerMutation.observe(state.innerContainer, { childList: true })

}

// library
async function waitUntilSuccess(func, timeout = 5000, delayBetweenAttempts = 100) {
  const start = new Date().getTime()
  let elapsedTime = 0, result = false, timeLeft = timeout

  while(result !== true && timeLeft > 0) {
    elapsedTime = new Date().getTime() - start
    timeLeft = timeout - elapsedTime
    result = await promiseSetTimeout(func, delayBetweenAttempts)
  }
}

async function promiseSetTimeout(func, delay) {
  return new Promise(resolve => {
    setTimeout(() => resolve(func()), delay)
  })
}

const trackStyle = `
  input[type="range"] {
    -webkit-appearance: slider-vertical;
    background-color: transparent;
  }

  input[type=range]::-webkit-runnable-track {
    background-color: red;
  }

  input[type="range"]::-ms-track {    
    border-color: transparent;
    color: transparent;
    width: 4px;
    border-radius: 3px;
    cursor: pointer;
  }

  input[type="range"]::-ms-fill-upper {
    background-color: lightgray;
    width: 4px;
    border-radius: 3px;
  }

  input[type="range"]::-ms-fill-lower {
    background-color: gray;
    width: 4px;
    border-radius: 3px;
  }

  input[type="range"]::-moz-range-progress {
    background-color: gray;
    width: 4px;
    border-radius: 3px;
  }

  input[type="range"]::-moz-range-track {
    background-color: lightgray;
    width: 4px;
    border-radius: 3px;
  }`
const thumbStyle = `
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    border: none;
    height: 18px;
    width: 18px;
    border-radius: 50%;
    background-color: #0f0f0f;
    cursor: pointer;
  }
    
  input[type=range]::-moz-range-thumb {
    border: none;
    height: 18px;
    width: 18px;
    border-radius: 50%;
    background-color: #0f0f0f;
    cursor: pointer;
  }`
GM_addStyle(trackStyle)
GM_addStyle(thumbStyle)

function createRangeSliderContainer() {
  const div = document.createElement('div')
  div.style.background = '#f2f2f2'
  div.style.padding = '15px 10px'
  div.style.borderRadius = '20px'
  div.style.width = '50%'
  div.style.display = 'flex'
  div.style.justifyContent = 'center'
  return div
}

function createRangeSlider(defaultValue, onInputFunc) {
  let slider = document.createElement('input')
  slider.type = 'range'
  slider.max = '1.0'
  slider.min = '0.0'
  slider.step = '0.01'
  slider.value = defaultValue
  
  slider.oninput = onInputFunc
  slider.setAttribute('orient', 'vertical')
  slider.style.height = '100px'
  slider.style.border = 'none'
  slider.style.borderRadius = '3px'
  slider.style.width = '4px'


  const container = createRangeSliderContainer()
  container.appendChild(slider)

  return { slider, wrappedSlider: container, }
}

function onChangeVolume(event) {
  const rawVolume = parseFloat(event.target.value)
  state.video.volume = transformVolume(rawVolume)
  state.rawVolume = rawVolume
  window.localStorage.setItem(LOCALSTORAGE_VOLUME, rawVolume)
  state.sliders.forEach(({ slider }) => slider.value = rawVolume)
}

// normalized exponential growth f(x) = ax^b
function transformVolume(value) {
  if (VOLUME_FUNCTION === 'linear') return value

  const a = 0.999939
  const b = 4.256127

  return a * Math.pow(value, b)
}