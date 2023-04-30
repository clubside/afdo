'use strict'

const { argv } = require('node:process')
const { spawnSync } = require('child_process')
const { lstatSync, readdirSync, Dirent } = require('fs')
const path = require('path')

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
		const itemName = rddata[i]
		const itemPath = `${dir}${path.sep}${itemName}`
		try {
			const stat = lstatSync(itemPath)
			if (stat.isFile()) {
				files.push(itemPath)
			} else if (stat.isDirectory()) {
				folders.push(itemPath)
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
		const outMain = audioFile.meta.title || audioFile.meta.artist
			? `${audioFile.meta.title || 'No Tile'} - ${audioFile.meta.artist || 'No Artist'}`
			: audioFile.meta.file
		const outDuration = audioFile.meta.durationCalc
			? ` (${audioFile.meta.durationCalc})`
			: audioFile.meta.durationRead ? ` (${audioFile.meta.durationRead})` : ''
		console.log(`${outMain}${outDuration}`)
	}
}

async function getEntry(file) {
	const result = spawnSync('ffmpeg', ['-i', file, '-f', 'ffmetadata', 'pipe:1'], { detached: true, encoding: 'binary' })
	// console.log(result)
	if (!result.stdout) {
		return undefined
	}
	const meta = await getMetaData(result.stdout)
	meta.durationRead = await getDuration(result.stderr)
	meta.file = path.basename(file)
	if (meta.file.indexOf('.')) {
		meta.file = meta.file.substring(0, meta.file.lastIndexOf('.'))
	}
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
	data.durationCalc = formatDuration(data.TLEN, '%m:%S')
	return data
}

async function getDuration(stderr) {
	// console.log(stderr)
	// TODO Round-up Math
	const durationIndex = stderr.indexOf('  Duration: ')
	if (durationIndex) {
		const durationParts = stderr.substring(durationIndex + 12, stderr.indexOf(',', durationIndex)).split(':')
		durationParts[3] = durationParts[2].substring(3)
		durationParts[2] = durationParts[2].substring(0, 2)
		// console.log(`Duration: ${stderr.substring(durationIndex + 12, stderr.indexOf(',', durationIndex))}`)
		// console.log(durationParts)
		if (Number(durationParts[0]) > 0) {
			return `${Number(durationParts[0])}:${durationParts[1]}:${durationParts[2]}`
		} else if (Number(durationParts[1]) > 0) {
			return `${Number(durationParts[1])}:${durationParts[2]}`
		} else if (Number(durationParts[2]) > 0) {
			return `0:${durationParts[2]}`
		} else {
			return undefined
		}
	}
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
