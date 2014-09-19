var io = require('socket.io-client');
var dgram = require('dgram');
var message = new Buffer("Some bytes");
var discoveryServer = dgram.createSocket("udp4");
var os = require('os');
var exec = require('exec');

discoveryServer.bind(41235,function() { discoveryServer.setBroadcast(true) });

var host = "http://192.168.6.107:3045";
//host = "http://127.0.0.1:3045";
var plugins = "";
var socket = "";
var piBoard = {
  init: function(){
    $('.secureConnect').unbind('click').bind('click', function(){
      var address = $("#passModal").attr('address');
      var password = $("#passModal form #inputPassword").val();
      piBoard.connectToBoard("http://" + address + ":3045", password);
      $('#passModal').modal('hide');
    });

    $('.disconnect').unbind('click').bind('click', function(){
      piBoard.disconnectFromBoard();
    });

    discoveryServer.on("message", function (msg, rinfo) {
      var msg = JSON.parse(msg);
      var $table = $('.page-container .boards-list tbody');
      if($table.length){
        var cssClass=""
        var button = '<button type="button" data-secured="inSecured" data-address="' + rinfo.address + '" class="btn btn-danger btn-sm table-striped">Connect..</button>';
        if(msg.isSecured){
          button = '<button type="button" data-secured="secured" data-address="' + rinfo.address + '" class="btn btn-success btn-sm table-striped">Connect..</button>';
        }
        $table.append('<tr class="' + cssClass + '"><td>' + msg.name + '</td><td>' + rinfo.address + '</td><td>' + msg.isSecured + '</td><td>' + button + '</td>');
      }
      $("button[data-secured='secured']").unbind("click").bind("click", function(){
        $('#passModal').attr('address', $(this).attr("data-address"));
        $('#passModal').modal('show');
      });
      $("button[data-secured='inSecured']").unbind("click").bind("click", function(){
        var address = $(this).attr("data-address");
        piBoard.connectToBoard("http://" + address + ":3045", "");
      });
    });
    piBoard.disconnectFromBoard();
  },
  pluginsHandler: function(data){
    plugins = data.plugins;
    $('.main-menu').html('');
    for(var i in plugins){
      var plugin = plugins[i];
      $('.main-menu').append('<li><a href="#" data-name="' + i + '">' + plugin.title + '</a></li>');
      if(plugin.methodsHandler){
        $('head').append(plugin.methodsHandler);
      }
    }
    piBoard.menuHandler();
  },
  connectToBoard: function(host, password){
    if(socket) socket.disconnect();
    socket = io.connect(host, {'force new connection':true, query: "pass=" + password });
    piBoard.socketHandler();
  },
  disconnectFromBoard: function(){
    if(socket) socket.disconnect();
    $('.navbar .board-info').addClass('hidden');
    $('.main-menu').html('');
    $('.page-header').html("Connect to piBoard");
    $('.main-menu').append('<li  class="active"><a href="#">Connect</a></li>');
    $('.page-container').html(
      '<table class="boards-list table table-hover">'
        + '<thead><tr><th>Name</th><th>Address</th><th>is Secured</th><th>Connect</th></tr></thead>'
        + '<tbody></tbody>' 
      + '</table>'
      + '<div class="pull-right"><button type="button" class="btn btn-primary scan-for-board">Scan <span class="glyphicon glyphicon-refresh"></span></button></div>'
    );
    $("button.scan-for-board").unbind('click').bind('click', function(){
      $('.page-container .boards-list tbody').html('');
      piBoard.scanForBoard();
    })
    piBoard.scanForBoard();
  },
  scanForBoard: function(){
    var ips = piBoard.ifconfig();
    for(var ifName in ips){
      if(ifName != 'local'){
        piBoard.getBroadCastAddress(ifName, function(error, address){
          if(error){
            discoveryServer.send(message, 0, message.length, 41234, ips.address);
            return;
          }else{
            discoveryServer.send(message, 0, message.length, 41234, address);
            return;
          }
        })
      }
    }
  },
  socketHandler: function(){
    socket.on('connect', function(){
      $('.navbar .board-info').removeClass('hidden');
      socket.on('plugins', piBoard.pluginsHandler);
      socket.emit("getPlugins");
    })
  },
  menuHandler: function(){
    $('.main-menu').on('click', 'a', function(){
      var pluginName = $(this).attr('data-name');
      $('.page-container').html(plugins[pluginName].content);
      $(document).unbind();
      $('.page-header').html(plugins[pluginName].title);
      $('.main-menu li').removeClass('active');
      $(this).parent().addClass('active');
      Holder.run();
    });
    $('.main-menu a:first').trigger('click');
  },
  ifconfig: function(){
    var interfaces = os.networkInterfaces();
    var externalIps = {};
    externalIps['local'] = {};
    externalIps['local']['name'] = 'local';
    externalIps['local']['address'] = '127.0.0.1';
    for(var ifName in interfaces) {
      var iFace = interfaces[ifName];
      for(var IPv in iFace){
        var connection = iFace[IPv];
        if(!connection.internal && connection.family == "IPv4") {
          externalIps[ifName] = {};
          externalIps[ifName]['name'] = ifName;
          externalIps[ifName]['address'] = connection.address;
        }
      }
    }
    return externalIps;
  },
  getBroadCastAddress: function(interface, callback){
    exec("ifconfig wlan0 | grep 'Bcast:'", {}, function(err, out, code){
        var regex = /Bcast:(\d+\.\d+\.\d+\.\d+)/g;
        var address = regex.exec(out);
        if(address[1]){
          callback(null, address[1]);
          return;
        }
        callback(address);
    });
  }
}

$(document).ready(function(){
  piBoard.init();
});
