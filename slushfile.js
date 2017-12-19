'use strict';

var gulp = require('gulp'),
    install = require('gulp-install'),
    template = require('gulp-template'),
    rename = require('gulp-rename'),
    gulpUtil = require('gulp-util'),
    _ = require('underscore'),
    inquirer = require('inquirer'),
    path = require('path'),
    colors = require('colors'),
    os = require('os'),
    fs = require('fs'),
    infoObj = {
    //     isProject: false
    },
    typeArr = ["web"],
    defaultView = {
        web: 'https://github.com/863183638/nodeTpl-for-slush.git'
    };
const exec = require('child_process').exec;

var parametersObj = _parametersHandler(process.argv); //处理传入相应参数的情况

function format (string) {
    var username = string.toLowerCase();
    return username.replace(/\s/g, '');
}

//获取默认信息,包括系统信息,工作目录信息
var defaults = (function () {
    var workingDirName, homeDir, osUserName, configFile, user;

    if (process.platform === 'win32') {
        homeDir = process.env.USERPROFILE;
        osUserName = process.env.USERNAME || path.basename(homeDir).toLowerCase();
    } else {
        homeDir = process.env.HOME || process.env.HOMEPATH;
        osUserName = homeDir && homeDir.split('/').pop() || 'root';
    }

    configFile = path.join(homeDir, '.gitconfig');
    user = {};

    if (require('fs').existsSync(configFile)) {
        user = require('iniparser').parseSync(configFile).user;
    }
    workingDirName = path.basename(process.cwd(), '');
    return {
        name: workingDirName,
        userName: osUserName || format(user.name || ''),
        author: user.name || '',
        authorEmail: user.email || ''
    };
})();
gulp.task('type', function (done) {
    fs.readdir(process.cwd(), function(err, files) {
        if (err) {
            throw err;
        }
        infoObj.notEmpty = files.length > 1 || (files.length == 1 && files[0] != '.DS_Store' );
        // done();
    });
    var promptArr = [];
    if (!parametersObj.type) {
        promptArr.push({
            type: 'list',
            name: 'type',
            message: "What's your app type ?",
            choices: typeArr
        })
    }
    if (!parametersObj.tplPath) {
        promptArr.push({
            type: 'confirm',
            name: 'hasOwnTpl',
            message: "Do you have custom template?",
            default: false
        });
    }
    inquirer.prompt(promptArr, function (answers) {
        _.extend(answers, parametersObj);
        infoObj.type = answers.type;
        // if (['web', 'mobile'].indexOf(answers.type) != -1) {
        //     infoObj.nameMessage = 'App Name(nodejs-' + answers.type + '-[name]):';
        //     infoObj.isProject = true;
        // } else {
        //     infoObj.nameMessage = 'Module Name:';
        // }
        if (!answers.hasOwnTpl) {
            infoObj.tplPath = '';
            done();
        } else {
            inquirer.prompt([{
                message: 'custom template URL:',
                name: 'tplPath'
            }], function (answer) {
                if (answer.tplPath) {
                    infoObj.tplPath = answer.tplPath;
                } else {
                    infoObj.tplPath = '';
                }
                done();
            });
        }
    });
});
gulp.task('info',['type'],function (done) {
    var prompts = [];
    var flag = false;
    if (!parametersObj.name && infoObj.notEmpty) {//工作目录为非空目录时,创建空文件夹
        prompts.push({
            name: 'name',
            // message: infoObj.nameMessage,
            message: 'Project Name:',
            default: defaults.name
        });
        flag = true;
    }
    if (!parametersObj.author && !flag) {
        prompts.push({
            name: 'author',
            message: 'What the author name?',
            default: defaults.author
        });
    }
    if (!parametersObj.description && !flag) {
        prompts.push({
            name: 'description',
            message: 'What the description?'
        });
    }
    if (!parametersObj.keywords && !flag) {
        prompts.push({
            name: 'keywords',
            message: 'Keywords:',
            default: defaults.keywords
        });
    }
    //Ask
    inquirer.prompt(prompts,
        function (answers) {

            _.extend(answers, {author:defaults.author});
            if (answers.name) {
                exec('mkdir ' + answers.name, (error, stdout, stderr) => {
                    if (error) {
                        console.log((`新建项目目录出错:\n ${error}`).red);
                    }
                    console.log(('    $cd ' + answers.name).green);
                    console.log(('    $slush node').green);
                    process.exit(0);
                });
            } else {
                answers.name = defaults.name;
                infoObj.name = answers.name;
                // 在系统temp目录中克隆默认模板,之后进行拷贝
                var tmpDir = os.tmpdir() + '/generatorTpl';
                exec('git clone ' + defaultView[infoObj.type] + ' ' + tmpDir, function (error, stdout, stderr) {
                    if (error) {
                        console.log((`拉取默认模板出错:\n ${error}`).red);
                        return;
                    }
                    try {
                        gulp.src([tmpDir + '/**/*', tmpDir + '/.*']) //创建文件流
                            .pipe(template(answers)) //替换模板文件中的变量
                            .pipe(rename(function(file){ //拷贝为指定的文件名,为了处理合并两次.gitignore的内容
                                if(file.basename === '.gitignore') {
                                    file.basename = '.npmignore';
                                }
                            }))
                            .pipe(gulp.dest('./')) //写入文件流
                            .on('end', function () {
                                if (infoObj.tplPath) {
                                    viewTpl(tmpDir, answers, done);
                                } else {
                                _ignoreHandler(answers); //合并两次.gitignore的内容
                                exec('rm -rf ' + tmpDir, (error, stdout, stderr) => {
                                    if (error) {
                                        console.log((`清除默认模板缓存时出错:\n ${error}`).red);
                                    }
                                    done();
                                });
                                }
                            });
                    } catch(e) {
                        exec('rm -rf ' + tmpDir, (error, stdout, stderr) => {
                            if (error) {
                                console.log((`清除默认模板缓存时出错:\n ${error}`).red);
                            }
                            throw  e;
                        });
                    }
                });

            }
            // if (infoObj.isProject && !answers.name.match(/^nodejs-/)) {
            //     answers.name = 'nodejs-' + infoObj.type + '-' + answers.name;
            // }
        });
});

gulp.task('default', ['info','type'], function (done) {
    exec('rm -rf ' + path.join(process.cwd(), '.npmignore'), (error, stdout, stderr) => {
    });
    //根据项目package.json进行npm编译
    gulp.src([path.join(process.cwd(), 'package.json')])
        .pipe(install())
        .pipe(gulpUtil.noop())
        .on('finish', function () {
            console.log(('Project "' + infoObj.name + '" generator success').green);
            done();
        });

});

function viewTpl(tmpDir,answers,done) {
    var tempPath = path.join(tmpDir,'customTpl');
    exec('git clone ' + infoObj.tplPath + ' ' + tempPath, function (error, stdout, stderr) {
        if (error) {
            console.log((`拉取自定义模板时出错:\n ${error}`).red);
            return;
        }
        gulp.src([tempPath + '/**/*',tempPath + '/.*'])
            .pipe(template(answers)) //替换模板文件中的变量
            .pipe(gulp.dest('./'))
            .on('end',function(){
                _ignoreHandler(answers);
                exec('rm -rf ' + tmpDir, (error, stdout, stderr) => {
                    if (error) {
                        console.log((`清楚自定义模板和默认模板时出错:\n ${error}`).red);
                    }
                    done();
                });
            });
    });
}


function _ignoreHandler (answers) {
    var npmignore, gitignore;
    try {
        npmignore = fs.readFileSync(path.join(process.cwd(), '.npmignore'), 'utf-8').split('\n');
    } catch (err) {
        npmignore = [];
    }
    try {
        gitignore = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf-8').split('\n');
    } catch (err) {
        gitignore = [];
    }
    var result = _mergeArr(npmignore, gitignore).join('\n');
    fs.writeFile(path.join(process.cwd(), '.gitignore'), result);
}

function _mergeArr (arr, arr2) {
    arr = arr || [];
    arr2 = arr2 || [];
    arr2.forEach(function (item) {
        if (arr.indexOf(item) == -1) {
            arr.push(item);
        }
    });
    return arr;
}

function _parametersHandler (argv) {
    var parameterObj = {};
    for (var i = 0; i < argv.length - 1; i++) {
        var temp = argv[i].match(/^--(.*)/);
        if (temp) {
            parameterObj[temp[1]] = argv[i + 1];
            i++;
        }
    }
    return parameterObj;
}
