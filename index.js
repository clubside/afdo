'use strict'

import { argv } from 'node:process'
import { lstatSync, readdirSync, Dirent } from 'fs'
import path from 'path'
import { parseFile } from 'music-metadata'
import { inspect, parseArgs } from 'util'

const audioExts = ['mp3', 'flac']

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
		if (audioExts.includes(file.split('.').pop())) {
			const audioFile = await getEntry(file)
			if (audioFile) {
				audioFiles.push(audioFile)
			}
		}
	}
	console.log(`Audio Files: ${audioFiles.length}`)
	audioFiles.sort((a, b) => Number(a.metadata.track) - Number(b.metadata.track))
	// console.log(audioFiles)
	for (const audioFile of audioFiles) {
		const outMain = audioFile.metadata.common.title || audioFile.metadata.common.artist
			? `${audioFile.metadata.common.title || 'No Tile'} - ${audioFile.metadata.common.artist || 'No Artist'}`
			: audioFile.metadata.file
		console.log(`${outMain} (${audioFile.metadata.duration})`)
	}
}

async function getEntry(file) {
	try {
		const metadata = await parseFile(file)
		// console.log(inspect(metadata, { showHidden: false, depth: null }))
		if (metadata.format) {
			metadata.duration = formatDuration(metadata.format.duration * 1000, '%m:%S')
			metadata.track = metadata.common.track.no || '0'
			metadata.file = path.basename(file)
			if (metadata.file.indexOf('.')) {
				metadata.file = metadata.file.substring(0, metadata.file.lastIndexOf('.'))
			}
			return { file, metadata }
		} else {
			return undefined
		}
	} catch (error) {
		console.error(error.message)
		return undefined
	}
}

const commandLineOptions = {
	folder: {
		type: 'string',
		short: 'f'
	},
	pattern: {
	  type: 'string',
	  short: 'p'
	},
	rename: {
		type: 'boolean',
		short: 'r'
	}
}
const {
	values,
	positionals
} = parseArgs({ options: commandLineOptions, allowPositionals: true })
console.log(values.folder)
// console.log(positionals)

const activeFolder = values.folder || argv[1]
const activeFiles = positionals

if (activeFiles.length > 0) {
	console.log(`Files: ${activeFiles}`)
} else {
	main(activeFolder)
}
