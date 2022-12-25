const app_config = require('./config.json');
const Bni = require('./bni');
const http = require('http');
const { io } = require("socket.io-client");

const arguments = process.argv;
let env = 'dev';
if (arguments[2]) env = arguments[2];

const config = ((env.toString().toLowerCase() == 'prod') ? app_config.prod : app_config.dev);

const server = http.createServer();
const socket = io(config.socket);

socket.on("reciveData", (data) => {
    data.transaction.forEach(e => {
        browser(config, e, data.server);
    });
})

const browser = async (cnf, data, server) => {
    const ress = {
        status : false,
    }
    const AppBni = new Bni(cnf, data.account);
    try {
        const login = await AppBni.login();
        if (!login.informasi_login) {
            ress.errors = "Failed Login [not have informasi-login]";
            ress.response = login;
        } else {
            ress.status = true;
            ress.data = login.informasi_login;
            ress.user = login.informasi_login.user.trim();
            if (data.type == "saldo") {
                ress.html = await AppBni.infoSaldo();
            }else if (data.type == "mutasi") {
                ress.html = await AppBni.mutasiRekening(data.account);
            }
            await AppBni.logout();
        }

        data.data = JSON.stringify(ress);
        socket.emit("updateData", {
            transaction: data,
            server: server
        });
    } catch (error) {
        ress.errors = error.message;
        data.data = JSON.stringify(ress);
        socket.emit("updateData", {
            transaction: data,
            server: server
        });
        await AppBni.closeWindows();
        console.log("error dari sini => ", error);
    }
}

server.listen(config.server_params.port, config.server_params.host, (Errors) => {	
	if (Errors) {
		throw Errors;
	}
	console.log("App BNI Scraper Running on Port:", config.server_params.port);
});
