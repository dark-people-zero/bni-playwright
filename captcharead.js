const recognize = require('tesseractocr')
const fs = require("fs");

class captchaRead {
	constructor(args, env = 'dev') {
		this.PythonsExec = {
			'prod'			: '/usr/bin/python',
			'live'			: '/usr/bin/python',
			'sandbox'		: 'python',
			'dev'			: 'python',
		}
		this.ImageMagicks = {
			'prod'			: '/usr/bin/convert',
			'live'			: '/usr/bin/convert',
			'sandbox'		: 'convert',
			'dev'			: 'magick',
		};
		
		this.pythonCmd = this.PythonsExec[`${env}`];
		this.imagemagickCmd = this.ImageMagicks[`${env}`];
		
		this.noise = args.noise;
		
		this.exec = require('child_process').exec;
	}
	async imgCleanNoise(script, img, pass_factor = 130) {
		return new Promise((resolve) => {
			this.exec(
				`${this.pythonCmd} "${script}" "${img}" ${pass_factor}`,
				(error, stdout, stderr) => {
					if (error) {
						console.warn(error);
					}
					resolve(stdout ? stdout : stderr);
				}
			);
		});
		
	}
	async imgThreshold(img, result) {
		return new Promise((resolve) => {
			this.exec(
				`${this.imagemagickCmd} "${img}" -flatten -fuzz 10% -trim +repage "${result}"`,
				(error, stdout, stderr) => {
					if (error) {
						console.warn(error);
					}
					resolve(stdout ? stdout : stderr);
				}
			);
		});
	}
	async imgTesseract(img) {
		return new Promise((resolve, reject) => {
			recognize(
				img,
				{ 
					psm: 7,
					config: "tessedit_char_whitelist=0123456789" 
				},
				
				(err, text) => {
					if (err) {
						return reject(err);
					}
					resolve(text.trim());
				}
			);
		});
	}
}


module.exports = captchaRead;
