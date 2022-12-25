const moment = require('moment');
const tzmoment = require('moment-timezone');
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const captcharead = require("./captcharead");
const x_ray = require("x-ray");
const readerPdf = require("./readearPdf");
const xpath = new x_ray({
	filters: {
		trim: (v) => {
			return typeof v === "string" ? v.trim() : v;
		},
	},
});
		
class BNI {
	constructor(args, account_params) {
		this.captcha_params = args.captcha_params;
		
		this.account = account_params;
		
		this.dir_cookie = args.dir_cookie;
		this.dir_captcha = args.dir_captcha;
        this.dir_download = args.dir_download;
		this.cookie_path = `${__dirname}/${this.dir_cookie}/${this.account.username}.json`;
		this.captcha_path = `${__dirname}/${this.dir_captcha}/${this.account.username}.jpg`;
        this.download_path = `${__dirname}/${this.dir_download}/${this.account.username}.pdf`;

        var dirCoo = path.join(__dirname, this.dir_cookie);
        var dirCapt = path.join(__dirname, this.dir_captcha);
        var dirDown = path.join(__dirname, this.dir_download);
        if (!fs.existsSync(dirCoo)) fs.mkdirSync(dirCoo, {recursive: true});
        if (!fs.existsSync(dirCapt)) fs.mkdirSync(dirCapt, {recursive: true});
        if (!fs.existsSync(dirDown)) fs.mkdirSync(dirDown, {recursive: true});

        this.captcha_read = new captcharead(this.captcha_params, args.env);
		this.BangkokDateTime = tzmoment.tz(moment().format('YYYY-MM-DDThh:mm:ss'), "Asia/Bangkok").format();

        this.url = "https://ibank.bni.co.id/corp/AuthenticationController?__START_TRAN_FLAG__=Y&FORMSGROUP_ID__=AuthenticationFG&__EVENT_ID__=LOAD&FG_BUTTONS__=LOAD&ACTION.LOAD=Y&AuthenticationFG.LOGIN_FLAG=1&BANK_ID=BNI01&LANGUAGE_ID=002";
        this.captcha_url = 'AuthenticationController;jsessionid';
        this.captcha_text = null;

        this.browser = null;
        this.context = null;
        this.page = null;
	}

    async currentDate() {
		let current_date = await tzmoment.tz(moment().format('YYYY-MM-DDThh:mm:ss'), "Asia/Bangkok");
		return {
			'international'			: current_date.format("YYYY-MM-DD"),
			'indonesia'				: current_date.format("DD-MM-YYYY"),
		}
	}
	
    async login() {
        const response = {
            status: false,
        }
        try {
            this.browser = await chromium.launch({
                headless: false,
            });
            this.context = await this.browser.newContext();
        
            this.page = await this.context.newPage();
            var page = this.page;
            this.getCaptcha();

            await page.goto(this.url);
            await this.inputLogin();
            response.informasi_login = await this.getInfoLogin();

            response.status = true;
            return response;
        } catch (error) {
            throw error;
        }
    }

    async getCaptcha() {
        try {
            var captcha_url = this.captcha_url,
            captcha_path = this.captcha_path,
            BangkokDateTime = this.BangkokDateTime,
            username = this.account.username;
            if (this.page != null) {
                this.page.on('response', function(res) {
                    if (res.url().includes(captcha_url)) {
                        res.body().then((e) => fs.writeFile(captcha_path, e.toString('base64'), 'base64', (err) => {
                            if (err != null) throw new Error(`[${BangkokDateTime}] ${username}: Cannot make login process on get_login_page()with error: ${err.message}.`);
                        }))
                    }
                });
            }
        } catch (error) {
            throw error;
        }
    }

    async getCaptchaText(captcha_path) {
        try {
			await this.captcha_read.imgThreshold(captcha_path, captcha_path);
			let response = await this.captcha_read.imgTesseract(captcha_path);
			return response.replace(" ","");
		} catch (Error) {
			throw Error;
		}
    }

    async inputLogin(try_input = 1) {
        try {
            try_input += 1;
            if (this.page != null) {
                this.captcha_text = await this.getCaptchaText(this.captcha_path);
                if (try_input < 5) {
                    await this.page.locator('input[name="AuthenticationFG.USER_PRINCIPAL"]').fill(this.account.username);
                    await this.page.locator('input[name="AuthenticationFG.ACCESS_CODE"]').fill(this.account.password);
                    await this.page.locator('input[name="AuthenticationFG.VERIFICATION_CODE"]').fill(this.captcha_text);
                    await this.page.locator('input[name="Action.VALIDATE_CREDENTIALS"]').click();
                    await this.page.waitForTimeout(5000);
                    
                    var attention = await this.page.$$('div[role="alert"]');
                    
                    if (attention.length > 0) {
                        attention = await this.page.locator('div[role="alert"]').textContent();
                        // jika salah password
                        if (attention.includes('User ID atau password yang anda masukkan salah')) {
                            throw new Error(attention);
                        }else if (attention.includes('Masukkan karakter yang anda lihat pada gambar')) {
                            return this.inputLogin(try_input);
                        }else{
                            throw new Error(attention);
                        }
                    }else{
                        var beranda = await this.page.locator('title').textContent();
                        if (!beranda.toLowerCase().includes('beranda')) {
                            await this.page.waitForTimeout(5000);
                        }
                    }
                }else{
                    throw new Error(`[${this.BangkokDateTime}] ${this.account.username}: Maximum try input login was 5 time(s).`);
                }
            }
        } catch (Error) {
            throw Error;
        }
    }

    async getInfoLogin() {
        try {
            return {
                user: (await this.page.locator('#firstName').innerText()).valueOf(),
            }
        } catch (Error) {
            throw Error;
        }
        
    }

    async infoSaldo() {
        try {
            await this.page.locator("#REKENING").click();
            await this.page.waitForTimeout(5000);
            await this.page.locator("#Informasi-Saldo--Mutasi_Mutasi-Tabungan--Giro").click();
            await this.page.waitForTimeout(5000);
            
            var body_content = await this.page.locator("#SummaryList").innerHTML();
            let footerFsScript = await xpath(body_content, {
				nomorRekening: ".listwhiterow .listgreyrowtxtleftline .bluelink",
                saldo: ".listwhiterow .amountrightalign"
			});
            return footerFsScript;
        } catch (Error) {
            throw Error;
        }
    }

    async mutasiRekening(account) {
        try {

            await this.page.locator("#REKENING").click();
            await this.page.waitForTimeout(5000);
            await this.page.locator("#Informasi-Saldo--Mutasi_Mutasi-Tabungan--Giro").click();
            await this.page.waitForTimeout(5000);
            await this.page.locator("#VIEW_TRANSACTION_HISTORY").click();
            await this.page.waitForTimeout(5000);
            var checkError = await this.page.$$('div[role="alert"]');
            if (checkError.length > 0) {
                return await this.page.locator('div[role="alert"]').textContent()
            }else{
                var start = moment(account.range.start, "YYYY-MM-DD").format("DD-MMM-YYYY");
                var end = moment(account.range.end, "YYYY-MM-DD").format("DD-MMM-YYYY");
                await this.page.locator('a[name="HREF_null"]').click();
                await this.page.waitForTimeout(1000);
                await this.page.locator('input[name="TransactionHistoryFG.SELECTED_RADIO_INDEX"]').first().click();
                await this.page.waitForTimeout(1000);
                await this.page.locator('input[name="TransactionHistoryFG.FROM_TXN_DATE"]').fill(start);
                await this.page.locator('input[name="TransactionHistoryFG.TO_TXN_DATE"]').fill(end);
                await this.page.locator('input[name="Action.SEARCH"]').click();
                await this.page.waitForTimeout(5000);

                const [ download ] = await Promise.all([
                    this.page.waitForEvent('download'),
                    await this.page.locator("#okButton").click()
                ]);
                console.log(await download.path());
                await download.saveAs(this.download_path);
                await this.page.waitForTimeout(10000);
                var date = this.getDaysArray(account.range.start, account.range.end);
                return await readerPdf(this.download_path, date);
            }
        } catch (Error) {
            throw Error;
        }
    }

    async logout() {
        await this.page.locator("#HREF_Logout").click();
        await this.page.waitForTimeout(2000);
        await this.page.locator("#LOG_OUT").click();
        await this.page.waitForTimeout(2000);
        await this.closeWindows();
    }

    async closeWindows() {
        this.context.close();
        this.browser.close();
    }

    getDaysArray(start, end) {
        for(var arr=[],dt=new Date(start); dt<=new Date(end); dt.setDate(dt.getDate()+1)){
            arr.push(moment(dt));
        }
        return arr;
    };
}

module.exports = BNI;
