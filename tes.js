const app_config = require('./config.json');
const Bni = require('./bni');
const arguments = process.argv;
let env = 'dev';
if (arguments[2]) env = arguments[2];

const config = ((env.toString().toLowerCase() == 'prod') ? app_config.prod : app_config.dev);

const AppBni = new Bni(config, {
    username: "riri1545035",
    password: "Aa778899"
});

(async() => {
    try {
        const login = await AppBni.login();

        if (!login.informasi_login) {
           console.log("error", login);
           await AppBni.closeWindows();
        } else {
            var saldo = await AppBni.mutasiRekening({
                range: {
                    start: "2022-12-24",
                    end: "2022-12-25"
                }
            });
            console.log(saldo);
            await AppBni.logout();
        }
    } catch (error) {
        console.log(error.message);
        await AppBni.closeWindows();
    }
})()



