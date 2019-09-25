
$(document).ready(function() {
    $('#usertable').dataTable({
        "pageLength" : 10,
        "lengthChange": false
    });
    $('.dataTables_length').css("color", "#fff");
    $('.dataTables_info').css("color", "#fff");
    $('.dataTables_filter').css("color", "#fff");
    $('#usertable tbody').on('click', 'tr', function () {
        var rowItems = $(this).children('td').map(function () {
            return this.innerHTML;
        }).toArray();
        $('#usermodal #userid').val(rowItems[1]);
        $('#usermodal #username').val(rowItems[2]);
        $('#usermodal #password').val(rowItems[3]);
        $("#usermodal #gender").val(rowItems[4]);
        $('#usermodal #email').val(rowItems[5]);
        $('#usermodal #gold').val(rowItems[6]);
        $('#usermodal #credits').val(rowItems[7]);
        $('#usermodal #bitcoin_id').val(rowItems[8]);

        $('#usermodal').modal('show');
    });
    
    $('#deleteacc').click(function(){
        swal({
        title: "Are you sure?",
        text: "You will not be able to recover this user",
        icon: "warning",
        buttons:  {
            cancel: true,
            confirm: "Delete"
        },
      }).then(function(isConfirm){          
        if (isConfirm) {
            var url = '/users' + '?' + $.param({"userid" :  $('#usermodal #userid').val()});
            console.log(url);
            $.ajax({
                url: url,               
                type: 'DELETE'
            }).then(function(data) {
                window.location.reload(false);
            });
        } else {
            swal("Cancelled", "Delete operation cancelled", "info");
        }
      });
    });
    $('#adduser').click(function() {
        $('#addusermodal').modal('show');
    });
    $('.adduserform').submit(function(e){
        e.preventDefault();
        $.ajax({
            url: '/users/add',
            data: {
                username: $('#addusermodal #username').val(),
                gender: $('#addusermodal #gender').val()=='Man' ? 1 : 2,
                password: $('#addusermodal #password').val(),
                email: $('#addusermodal #email').val(),
                gold: $('#addusermodal #gold').val(),
                credits: $('#addusermodal #credits').val(),
                bitcoinid: $('#addusermodal #bitcoin_id').val(),
            },
            method: 'POST'
        }).done(function(data) {
            console.log(data);
            swal("Success", "User successfully added", "success").then(function(){
                window.location.reload(false);
            });
        }).fail(function(data){
            swal("Operation Failed", "This user is already taken.", "error");
        });
    });
    $('#blackjacktable').DataTable({
        "pageLength" : 10,
        "lengthChange": false
    });
    $('.dataTables_length').css("color", "#fff");
    $('.dataTables_info').css("color", "#fff");
    $('.dataTables_filter').css("color", "#fff");

    $('#blackjacktable tbody').on('click', 'tr', function () {
        var rowItems = $(this).children('td').map(function () {
            if($(this).children().length > 0)
                return $(this).children(0).text();
            return this.innerHTML;
        }).toArray();
        $('#tablemodal #tableid').val(rowItems[0]);
        $('#tablemodal #tableobjid').val(rowItems[1]);
        $('#tablemodal #tablename').val(rowItems[2]);
        $('#tablemodal #buyinlimit').val(rowItems[3]);
        $("#tablemodal #raisemin").val(rowItems[4]);
        $('#tablemodal #raisemax').val(rowItems[5]);
        $('#tablemodal #customed').val(rowItems[6]);
        $('#tablemodal #maxplayer').val(rowItems[7]);
        $('#tablemodal #minplayer').val(rowItems[8]);

        $('#tablemodal').modal('show');
    });
    
    $('#deletetable').click(function(){
        swal({
        title: "Are you sure?",
        text: "You will not be able to recover this table",
        icon: "warning",
        buttons:  {
            cancel: true,
            confirm: "Delete"
        },
      }).then(function(isConfirm){          
        if (isConfirm) {
            var url = '/tables' + '?' + $.param({"objectid" :  $('#tablemodal #tableobjid').val(), 'tableid' : $('#tablemodal #tableid').val()});
            console.log(url);
            $.ajax({
                url: url,               
                type: 'DELETE'
            }).then(function(data) {
                window.location.reload(false);
            });
        } else {
            swal("Cancelled", "Delete operation cancelled", "info");
        }
      });
    });
    $('#addtable').click(function() {
        $('#addtablemodal').modal('show');
    });
    $('#addtablebtn').click(function() {
        $.ajax({
            url: '/tables/add',
            data: {
                table_name: $('#addtablemodal #tablename').val(),
                buyin_limit: $('#addtablemodal #buyinlimit').val(),
                raise_min: $('#addtablemodal #raisemin').val(),
                raise_max: $('#addtablemodal #raisemax').val(),
                customed: $('#addtablemodal #customed').val() == 'Default' ? false:true,
                Max_player: $('#addtablemodal #maxplayer').val(),
                Min_player: $('#addtablemodal #minplayer').val(),
            },
            method: 'POST'
        }).done(function(data) {
            console.log(data);
            swal("Success", "Table successfully added", "success").then(function(){
                window.location.reload(false);
            });
        }).fail(function(data){
            swal("Failed", "Operation Failed", "error");
        });
    });
    
});