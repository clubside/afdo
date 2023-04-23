'use strict'

const { argv } = require('node:process')
const { spawnSync } = require('child_process')
const { lstatSync, readdirSync, Dirent } = require('fs')
const { sep } = require('path')

// Set path to ffmpeg - optional if in $PATH or $FFMPEG_PATH
// ffmetadata.setFfmpegPath('\\\\CLUBNAS\\pc\\NewsBin\\Time-Life\\Sounds of the 70s\\Sounds of the 70s - Hit Wonders\\Sounds Of The Seventies - Wonderhits Disc 1')
// ffmetadata.setFfmpegPath('//CLUBNAS/pc/NewsBin/Time-Life/Sounds of the 70s/Sounds of the 70s - Hit Wonders/Sounds Of The Seventies - Wonderhits Disc 1')

function formatDuration(duration, format) {
	if (isNaN(duration)) {
		return undefined
	}
	const milliseconds = Math.floor((duration % 1000) / 100)
	const seconds = Math.floor((duration / 1000) % 60)
	const minutes = Math.floor((duration / (1000 * 60)) % 60)
	const hours = Math.floor((duration / (1000 * 60 * 60)) % 24)
	const days = Math.floor(duration / (60 * 60 * 24 * 1000))

	format = format.replace(/%n/mg, milliseconds)
	format = format.replace(/%N/mg, milliseconds.toString().padStart(2, '0'))
	format = format.replace(/%s/mg, seconds)
	format = format.replace(/%S/mg, seconds.toString().padStart(2, '0'))
	format = format.replace(/%m/mg, minutes)
	format = format.replace(/%M/mg, minutes.toString().padStart(2, '0'))
	format = format.replace(/%h/mg, hours)
	format = format.replace(/%H/mg, hours.toString().padStart(2, '0'))
	format = format.replace(/%d/mg, days)
	format = format.replace(/%D/mg, days.toString().padStart(2, '0'))

	return format
}

async function main(dir) {
	// const dir = '//CLUBNAS/pc/NewsBin/Time-Life/Sounds of the 70s/Sounds of the 70s - Hit Wonders/Sounds Of The Seventies - Wonderhits Disc 2'
	const rddata = readdirSync(dir)
	const files = []
	const folders = []
	const audioFiles = []

	for (let i = 0; i < rddata.length; ++i) {
		const name = rddata[i]
		const path = `${dir}${sep}${name}`
		try {
			const stat = lstatSync(path)
			if (stat.isFile()) {
				files.push(path)
			} else if (stat.isDirectory()) {
				folders.push(path)
			}
		} catch (e) {
			console.error(`Unable to read ${path}`)
		}
	}

	for (const file of files) {
		const audioFile = await getEntry(file)
		if (audioFile) {
			audioFiles.push(audioFile)
		}
	}
	console.log(`Audio Files: ${audioFiles.length}`)
	audioFiles.sort((a, b) => Number(a.meta.track) - Number(b.meta.track))
	// console.log(audioFiles)
	for (const audioFile of audioFiles) {
		console.log(`${audioFile.meta.title || 'No Tile'} - ${audioFile.meta.artist || 'No Artist'}${audioFile.meta.duration ? ` (${audioFile.meta.duration})` : ''}`)
	}
}

async function getEntry(file) {
	const result = spawnSync('ffmpeg', ['-i', file, '-f', 'ffmetadata', 'pipe:1'], { detached: true, encoding: 'binary' })
	// console.log(result)
	const data = result.stdout
	if (!data) {
		return undefined
	}
	const meta = await getMetaData(data)
	return { file, meta }
}

async function getMetaData(stdio) {
	const lines = stdio.split('\n')
	const data = {}
	let key
	for (const line of lines) {
		if (line.substring(0, 1) !== ';') {
			const index = line.indexOf('=')
			if (index === -1) {
				data[key] += line.slice(index + 1)
				data[key] = data[key].replace('\\', '\n')
			} else {
				key = line.slice(0, index)
				data[key] = line.slice(index + 1)
			}
		}
	}
	data.track = data.track || '0'
	data.duration = formatDuration(data.TLEN, '%m:%S')
	return data
}

let activeFolder = __dirname
let activeFile = ''

if (argv.length > 2) {
	for (let arg = 2; arg < argv.length; arg++) {
		switch (argv[arg]) {
			case '-f':
				if (arg + 1 < argv.length) {
					activeFolder = argv[arg + 1]
					arg++
				}
				break
			default:
				activeFile = argv[arg]
		}
	}
	argv.forEach((val, index) => {
		console.log(`${index}: ${val}`)
	})
}

main(activeFolder)
